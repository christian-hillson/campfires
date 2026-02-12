import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const HOOK_MARKER = '# -- campfires-agent-hook --';
const CONFIG_FILE = 'campfires.json';

interface HookConfig {
  serverUrl: string;
  agentToken: string;
}

interface InstallOptions {
  workDir: string;
  serverUrl: string;
  agentToken: string;
}

function getGitDir(workDir: string): string {
  return join(workDir, '.git');
}

function writeConfig(gitDir: string, config: HookConfig): void {
  const configPath = join(gitDir, CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function generatePostCommitHook(): string {
  return `${HOOK_MARKER}
# Campfires agent hook: emit commit activity
CONFIG_FILE="$(dirname "$0")/../campfires.json"
if [ -f "$CONFIG_FILE" ]; then
  SERVER_URL=$(cat "$CONFIG_FILE" | grep -o '"serverUrl"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"serverUrl"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
  AGENT_TOKEN=$(cat "$CONFIG_FILE" | grep -o '"agentToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agentToken"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
  COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null)
  COMMIT_MSG=$(git log -1 --pretty=%s 2>/dev/null | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\\\"/g' | head -c 500)
  curl -s -X POST "$SERVER_URL/api/agents/activity" \\
    -H "Authorization: Bearer $AGENT_TOKEN" \\
    -H "Content-Type: application/json" \\
    --max-time 5 \\
    -d "{\\"type\\":\\"commit\\",\\"message\\":\\"$COMMIT_MSG\\",\\"metadata\\":{\\"hash\\":\\"$COMMIT_HASH\\"}}" \\
    >/dev/null 2>&1 || true
fi
${HOOK_MARKER}`;
}

function generatePostCheckoutHook(): string {
  return `${HOOK_MARKER}
# Campfires agent hook: emit branch switch activity
CONFIG_FILE="$(dirname "$0")/../campfires.json"
if [ -f "$CONFIG_FILE" ]; then
  # Only fire on branch switches (flag=1), not file checkouts (flag=0)
  if [ "$3" = "1" ]; then
    SERVER_URL=$(cat "$CONFIG_FILE" | grep -o '"serverUrl"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"serverUrl"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
    AGENT_TOKEN=$(cat "$CONFIG_FILE" | grep -o '"agentToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agentToken"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
    BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\\\"/g')
    curl -s -X POST "$SERVER_URL/api/agents/activity" \\
      -H "Authorization: Bearer $AGENT_TOKEN" \\
      -H "Content-Type: application/json" \\
      --max-time 5 \\
      -d "{\\"type\\":\\"branch_switch\\",\\"branch\\":\\"$BRANCH\\"}" \\
      >/dev/null 2>&1 || true
  fi
fi
${HOOK_MARKER}`;
}

function installHookFile(hookPath: string, hookContent: string): void {
  let existing = '';

  if (existsSync(hookPath)) {
    existing = readFileSync(hookPath, 'utf-8');

    // Already installed — remove old version first
    if (existing.includes(HOOK_MARKER)) {
      existing = removeHookSection(existing);
    }
  } else {
    existing = '#!/bin/sh\n';
  }

  // Append our hook section
  const finalContent = existing.trimEnd() + '\n\n' + hookContent + '\n';
  writeFileSync(hookPath, finalContent, 'utf-8');
  chmodSync(hookPath, 0o755);
}

function removeHookSection(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let insideMarker = false;

  for (const line of lines) {
    if (line.trim() === HOOK_MARKER) {
      insideMarker = !insideMarker;
      continue;
    }
    if (!insideMarker) {
      result.push(line);
    }
  }

  return result.join('\n');
}

export function installGitHooks(options: InstallOptions): void {
  const gitDir = getGitDir(options.workDir);

  if (!existsSync(gitDir)) {
    throw new Error('Not a git repository');
  }

  const hooksDir = join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Write config file
  writeConfig(gitDir, {
    serverUrl: options.serverUrl,
    agentToken: options.agentToken,
  });

  // Install hooks
  installHookFile(join(hooksDir, 'post-commit'), generatePostCommitHook());
  installHookFile(join(hooksDir, 'post-checkout'), generatePostCheckoutHook());
}

export function uninstallGitHooks(workDir: string): void {
  const gitDir = getGitDir(workDir);

  if (!existsSync(gitDir)) return;

  // Remove config file
  const configPath = join(gitDir, CONFIG_FILE);
  if (existsSync(configPath)) {
    unlinkSync(configPath);
  }

  // Remove hook sections from hook files
  const hooksDir = join(gitDir, 'hooks');
  for (const hookName of ['post-commit', 'post-checkout']) {
    const hookPath = join(hooksDir, hookName);
    if (!existsSync(hookPath)) continue;

    const content = readFileSync(hookPath, 'utf-8');
    if (!content.includes(HOOK_MARKER)) continue;

    const cleaned = removeHookSection(content);

    // If only the shebang remains, remove the file entirely
    if (cleaned.trim() === '#!/bin/sh' || cleaned.trim() === '') {
      unlinkSync(hookPath);
    } else {
      writeFileSync(hookPath, cleaned, 'utf-8');
    }
  }
}
