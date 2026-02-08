"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadToken = loadToken;
exports.saveToken = saveToken;
exports.decodeTokenPayload = decodeTokenPayload;
exports.interactiveLogin = interactiveLogin;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const readline = __importStar(require("node:readline"));
const TOKEN_DIR = path.join(os.homedir(), '.campfires');
const TOKEN_PATH = path.join(TOKEN_DIR, 'token');
function loadToken() {
    try {
        return fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
    }
    catch {
        return null;
    }
}
function saveToken(token) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
}
function decodeTokenPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        // Base64url decode the payload segment
        const payload = parts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const decoded = Buffer.from(payload, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }
    catch {
        return null;
    }
}
function prompt(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer));
    });
}
async function interactiveLogin(serverUrl) {
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
            const err = await res.json();
            throw new Error(err.error || `Login failed (${res.status})`);
        }
        const data = await res.json();
        saveToken(data.token);
        const payload = decodeTokenPayload(data.token);
        if (!payload) {
            throw new Error('Failed to decode token');
        }
        console.error('Logged in as ' + data.user.displayName + '\n');
        return { token: data.token, payload };
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=auth.js.map