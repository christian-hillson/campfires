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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const awareness_provider_1 = require("./awareness-provider");
const idle_detector_1 = require("./idle-detector");
const git_watcher_1 = require("./git-watcher");
const status_bar_1 = require("./status-bar");
const decorations_1 = require("./decorations");
const campfire_panel_1 = require("./campfire-panel");
const SECRET_KEY_TOKEN = 'campfires.token';
const SECRET_KEY_USER = 'campfires.user';
const CONFIG_SERVER_URL = 'campfires.serverUrl';
const DEFAULT_SERVER_URL = 'http://localhost:3000';
let awarenessProvider = null;
let idleDetector = null;
let gitWatcher = null;
let statusBar = null;
let decorationManager = null;
let campfirePanel = null;
async function activate(context) {
    console.log('Campfires extension activating...');
    // Initialize status bar (always visible)
    statusBar = new status_bar_1.StatusBar();
    context.subscriptions.push(statusBar);
    // Initialize decoration manager
    decorationManager = new decorations_1.DecorationManager();
    context.subscriptions.push(decorationManager);
    // Initialize and register campfire panel
    campfirePanel = new campfire_panel_1.CampfirePanel(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(campfire_panel_1.CampfirePanel.viewType, campfirePanel));
    // Register commands
    registerCommands(context);
    // Try to auto-connect with stored credentials
    const token = await context.secrets.get(SECRET_KEY_TOKEN);
    const userJson = await context.secrets.get(SECRET_KEY_USER);
    if (token && userJson) {
        try {
            const user = JSON.parse(userJson);
            await connect(context, token, user);
        }
        catch (error) {
            console.error('Failed to auto-connect:', error);
            statusBar.showNotConnected();
        }
    }
    else {
        statusBar.showNotConnected();
    }
    console.log('Campfires extension activated');
}
function registerCommands(context) {
    // Toggle draft mode
    context.subscriptions.push(vscode.commands.registerCommand('campfires.toggleDraftMode', () => {
        if (!awarenessProvider) {
            vscode.commands.executeCommand('campfires.login');
            return;
        }
        const newMode = !awarenessProvider.getDraftMode();
        awarenessProvider.setDraftMode(newMode);
        statusBar?.setDraftMode(newMode);
        vscode.window.showInformationMessage(newMode
            ? 'Draft mode enabled. Your activity is now hidden.'
            : 'Draft mode disabled. You are now visible to your team.');
    }));
    // Login
    context.subscriptions.push(vscode.commands.registerCommand('campfires.login', async () => {
        await showLoginFlow(context);
    }));
    // Logout
    context.subscriptions.push(vscode.commands.registerCommand('campfires.logout', async () => {
        await disconnect(context);
        vscode.window.showInformationMessage('Signed out of Campfires');
    }));
    // Join team
    context.subscriptions.push(vscode.commands.registerCommand('campfires.joinTeam', async () => {
        const token = await context.secrets.get(SECRET_KEY_TOKEN);
        if (!token) {
            vscode.window.showWarningMessage('Please sign in first');
            vscode.commands.executeCommand('campfires.login');
            return;
        }
        const inviteCode = await vscode.window.showInputBox({
            prompt: 'Enter team invite code',
            placeHolder: 'ABCD1234',
        });
        if (!inviteCode)
            return;
        try {
            const serverUrl = getServerUrl();
            const response = await fetch(`${serverUrl}/api/teams/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ inviteCode }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to join team');
            }
            const { team, user, token: newToken } = await response.json();
            await context.secrets.store(SECRET_KEY_USER, JSON.stringify(user));
            await context.secrets.store(SECRET_KEY_TOKEN, newToken);
            // Reconnect with new team and new token
            await disconnect(context);
            await connect(context, newToken, user);
            vscode.window.showInformationMessage(`Joined team: ${team.name}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to join team: ${error}`);
        }
    }));
    // Refresh
    context.subscriptions.push(vscode.commands.registerCommand('campfires.refresh', () => {
        if (awarenessProvider) {
            awarenessProvider.updateAwareness();
        }
    }));
}
async function showLoginFlow(context) {
    const action = await vscode.window.showQuickPick(['Sign In', 'Sign Up'], {
        placeHolder: 'Choose an action',
    });
    if (!action)
        return;
    const email = await vscode.window.showInputBox({
        prompt: 'Enter your email',
        placeHolder: 'you@example.com',
    });
    if (!email)
        return;
    const password = await vscode.window.showInputBox({
        prompt: 'Enter your password',
        password: true,
    });
    if (!password)
        return;
    let displayName;
    if (action === 'Sign Up') {
        displayName = await vscode.window.showInputBox({
            prompt: 'Enter your display name',
            placeHolder: 'Your Name',
        });
        if (!displayName)
            return;
    }
    try {
        const serverUrl = getServerUrl();
        const endpoint = action === 'Sign Up' ? '/api/auth/signup' : '/api/auth/login';
        const body = action === 'Sign Up'
            ? { email, password, displayName }
            : { email, password };
        const response = await fetch(`${serverUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Authentication failed');
        }
        const { token, user } = await response.json();
        // Store credentials
        await context.secrets.store(SECRET_KEY_TOKEN, token);
        await context.secrets.store(SECRET_KEY_USER, JSON.stringify(user));
        if (user.teamId) {
            await connect(context, token, user);
            vscode.window.showInformationMessage('Signed in to Campfires!');
        }
        else {
            statusBar?.showNotConnected();
            vscode.window.showInformationMessage('Signed in! Use "Campfires: Join Team" to join a team.');
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Authentication failed: ${error}`);
    }
}
async function connect(context, token, user) {
    if (!user.teamId) {
        statusBar?.showNotConnected();
        return;
    }
    const serverUrl = getServerUrl();
    // Create awareness provider
    awarenessProvider = new awareness_provider_1.AwarenessProvider({
        userId: user.userId,
        displayName: user.displayName,
        teamId: user.teamId,
        token,
        serverUrl,
        color: user.avatarColor,
    });
    // Set up connection callbacks
    awarenessProvider.onConnectionChange((state) => {
        statusBar?.setConnectionState(state.connected, state.reconnecting);
        if (state.connected) {
            awarenessProvider?.pushActivityEvent('session_start');
        }
    });
    // Set up awareness callbacks
    awarenessProvider.onAwarenessChange((states) => {
        statusBar?.setActiveCount(states.size);
        campfirePanel?.updateAwareness(states);
        decorationManager?.updatePresence(states, user.userId);
    });
    // Set up activity callbacks
    awarenessProvider.onActivityChange((events) => {
        campfirePanel?.updateActivityFeed(events);
    });
    // Connect to server
    awarenessProvider.connect();
    campfirePanel?.setCurrentUser(user.userId, user.displayName);
    // Set up idle detector
    idleDetector = new idle_detector_1.IdleDetector((isIdle) => {
        awarenessProvider?.setIdle(isIdle);
    });
    context.subscriptions.push(idleDetector);
    // Set up git watcher
    gitWatcher = new git_watcher_1.GitWatcher((event) => {
        if (event.type === 'commit') {
            awarenessProvider?.pushActivityEvent('commit', {
                branch: event.branch,
                message: event.message,
            });
        }
        else if (event.type === 'branch_switch') {
            awarenessProvider?.setCurrentBranch(event.branch);
            awarenessProvider?.pushActivityEvent('branch_switch', {
                branch: event.branch,
            });
        }
    });
    context.subscriptions.push(gitWatcher);
    // Initialize current branch
    const currentBranch = gitWatcher.getCurrentBranch();
    if (currentBranch) {
        awarenessProvider.setCurrentBranch(currentBranch);
    }
    // Set up file watchers
    setupFileWatchers(context);
}
function setupFileWatchers(context) {
    // Active editor change (file open)
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor || !awarenessProvider)
            return;
        const relativePath = getRelativePath(editor.document.uri);
        awarenessProvider.setCurrentFile(relativePath);
        awarenessProvider.pushActivityEvent('file_open', { file: relativePath });
        // Update current function
        updateCurrentFunction(editor);
    }));
    // Cursor position change (function detection)
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((event) => {
        updateCurrentFunction(event.textEditor);
    }));
    // File save
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        if (!awarenessProvider)
            return;
        const relativePath = getRelativePath(document.uri);
        awarenessProvider.pushActivityEvent('file_save', { file: relativePath });
    }));
    // Initialize with current editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && awarenessProvider) {
        const relativePath = getRelativePath(activeEditor.document.uri);
        awarenessProvider.setCurrentFile(relativePath);
        updateCurrentFunction(activeEditor);
    }
}
async function updateCurrentFunction(editor) {
    if (!awarenessProvider)
        return;
    try {
        const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', editor.document.uri);
        if (!symbols) {
            awarenessProvider.setCurrentFunction(null);
            return;
        }
        const position = editor.selection.active;
        const functionSymbol = findContainingFunction(symbols, position);
        awarenessProvider.setCurrentFunction(functionSymbol?.name || null);
    }
    catch {
        awarenessProvider.setCurrentFunction(null);
    }
}
function findContainingFunction(symbols, position) {
    for (const symbol of symbols) {
        if (!symbol.range.contains(position))
            continue;
        // Check if it's a function-like symbol
        if (symbol.kind === vscode.SymbolKind.Function ||
            symbol.kind === vscode.SymbolKind.Method ||
            symbol.kind === vscode.SymbolKind.Constructor) {
            // Check children for a more specific match
            const child = findContainingFunction(symbol.children, position);
            return child || symbol;
        }
        // Recurse into children
        const child = findContainingFunction(symbol.children, position);
        if (child)
            return child;
    }
    return null;
}
function getRelativePath(uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return uri.fsPath;
    }
    return vscode.workspace.asRelativePath(uri, false);
}
function getServerUrl() {
    const config = vscode.workspace.getConfiguration('campfires');
    return config.get('serverUrl') || DEFAULT_SERVER_URL;
}
async function disconnect(context) {
    if (awarenessProvider) {
        awarenessProvider.dispose();
        awarenessProvider = null;
    }
    if (idleDetector) {
        idleDetector.dispose();
        idleDetector = null;
    }
    if (gitWatcher) {
        gitWatcher.dispose();
        gitWatcher = null;
    }
    decorationManager?.clearAllDecorations();
    statusBar?.showNotConnected();
    await context.secrets.delete(SECRET_KEY_TOKEN);
    await context.secrets.delete(SECRET_KEY_USER);
}
function deactivate() {
    if (awarenessProvider) {
        awarenessProvider.dispose();
    }
    if (idleDetector) {
        idleDetector.dispose();
    }
    if (gitWatcher) {
        gitWatcher.dispose();
    }
    if (decorationManager) {
        decorationManager.dispose();
    }
    if (statusBar) {
        statusBar.dispose();
    }
}
//# sourceMappingURL=extension.js.map