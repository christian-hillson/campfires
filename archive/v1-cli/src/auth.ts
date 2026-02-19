import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';
import type { AuthResponse } from '@campfires/shared';
import type { TokenPayload } from './types.js';

const TOKEN_DIR = path.join(os.homedir(), '.campfires');
const TOKEN_PATH = path.join(TOKEN_DIR, 'token');

export function loadToken(): string | null {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
}

export function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url decode the payload segment
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

export async function interactiveLogin(
  serverUrl: string,
): Promise<{ token: string; payload: TokenPayload }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr, // Prompts on stderr so stdout stays clean
  });

  try {
    console.error('\n🔥 Campfire Login\n');

    const email = await prompt(rl, 'Email: ');
    const password = await prompt(rl, 'Password: ');

    const res = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error || `Login failed (${res.status})`);
    }

    const data = (await res.json()) as AuthResponse;
    saveToken(data.token);

    const payload = decodeTokenPayload(data.token);
    if (!payload) {
      throw new Error('Failed to decode token');
    }

    console.error('Logged in as ' + data.user.displayName + '\n');
    return { token: data.token, payload };
  } finally {
    rl.close();
  }
}
