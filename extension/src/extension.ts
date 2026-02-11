import * as vscode from 'vscode';
import type { JwtPayload, Team } from '@campfires/shared';
import { AwarenessProvider } from './awareness-provider';
import { IdleDetector } from './idle-detector';
import { GitWatcher } from './git-watcher';
import { StatusBar } from './status-bar';
import { DecorationManager } from './decorations';
import { CampfirePanel } from './campfire-panel';

const SECRET_KEY_TOKEN = 'campfires.token';
const SECRET_KEY_USER = 'campfires.user';
const DEFAULT_SERVER_URL = 'http://localhost:3000';

let awarenessProvider: AwarenessProvider | null = null;
let idleDetector: IdleDetector | null = null;
let gitWatcher: GitWatcher | null = null;
let statusBar: StatusBar | null = null;
let decorationManager: DecorationManager | null = null;
let campfirePanel: CampfirePanel | null = null;
let visitProvider: AwarenessProvider | null = null;
let visitedTeamName: string | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Campfires extension activating...');

  // Initialize status bar (always visible)
  statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  // Initialize decoration manager
  decorationManager = new DecorationManager();
  context.subscriptions.push(decorationManager);

  // Initialize and register campfire panel
  campfirePanel = new CampfirePanel(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CampfirePanel.viewType, campfirePanel),
  );

  // Register commands
  registerCommands(context);

  // Try to auto-connect with stored credentials
  const token = await context.secrets.get(SECRET_KEY_TOKEN);
  const userJson = await context.secrets.get(SECRET_KEY_USER);

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      await connect(context, token, user);
    } catch (error) {
      console.error('Failed to auto-connect:', error);
      statusBar.showNotConnected();
    }
  } else {
    statusBar.showNotConnected();
  }

  console.log('Campfires extension activated');
}

function registerCommands(context: vscode.ExtensionContext): void {
  // Toggle draft mode
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.toggleDraftMode', () => {
      if (!awarenessProvider) {
        vscode.commands.executeCommand('campfires.login');
        return;
      }

      const newMode = !awarenessProvider.getDraftMode();
      awarenessProvider.setDraftMode(newMode);
      statusBar?.setDraftMode(newMode);

      vscode.window.showInformationMessage(
        newMode
          ? 'Draft mode enabled. Your activity is now hidden.'
          : 'Draft mode disabled. You are now visible to your team.',
      );
    }),
  );

  // Login
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.login', async () => {
      await showLoginFlow(context);
    }),
  );

  // Logout
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.logout', async () => {
      await disconnect(context);
      vscode.window.showInformationMessage('Signed out of Campfires');
    }),
  );

  // Join team
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.joinTeam', async () => {
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

      if (!inviteCode) return;

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
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || 'Failed to join team');
        }

        const {
          team,
          user,
          token: newToken,
        } = (await response.json()) as {
          team: { name: string };
          user: { userId: string; displayName: string; teamId: string; avatarColor: string };
          token: string;
        };
        await context.secrets.store(SECRET_KEY_USER, JSON.stringify(user));
        await context.secrets.store(SECRET_KEY_TOKEN, newToken);

        // Reconnect with new team and new token
        await disconnect(context);
        await connect(context, newToken, user);

        vscode.window.showInformationMessage(`Joined team: ${team.name}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to join team: ${error}`);
      }
    }),
  );

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.refresh', () => {
      if (awarenessProvider) {
        awarenessProvider.updateAwareness();
      }
    }),
  );

  // Visit another campfire
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.visitCampfire', async () => {
      if (!awarenessProvider) {
        vscode.window.showWarningMessage('Please sign in first');
        vscode.commands.executeCommand('campfires.login');
        return;
      }

      const token = await context.secrets.get(SECRET_KEY_TOKEN);
      const userJson = await context.secrets.get(SECRET_KEY_USER);
      if (!token || !userJson) {
        vscode.window.showWarningMessage('Please sign in first');
        return;
      }

      const user = JSON.parse(userJson);
      const serverUrl = getServerUrl();

      // Decode JWT to get orgId and teamId
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      ) as JwtPayload;

      if (!payload.orgId || !payload.teamId) {
        vscode.window.showWarningMessage('You need to join a team first');
        return;
      }

      try {
        // Fetch org teams
        const teamsRes = await fetch(`${serverUrl}/api/orgs/${payload.orgId}/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!teamsRes.ok) throw new Error('Failed to fetch teams');

        const teams: Team[] = (await teamsRes.json()) as Team[];
        const otherTeams = teams.filter((t) => t.teamId !== payload.teamId);

        if (otherTeams.length === 0) {
          vscode.window.showInformationMessage('No other teams in your organization');
          return;
        }

        const pick = await vscode.window.showQuickPick(
          otherTeams.map((t) => ({ label: t.name, description: t.description, teamId: t.teamId })),
          { placeHolder: 'Select a campfire to visit' },
        );
        if (!pick) return;

        // If already visiting, leave first
        if (visitProvider) {
          visitProvider.dispose();
          visitProvider = null;
        }

        // Create visitor awareness provider
        visitProvider = new AwarenessProvider({
          userId: user.userId,
          displayName: user.displayName,
          teamId: pick.teamId,
          token,
          serverUrl,
          color: user.avatarColor,
          visitorMode: true,
          homeTeamId: payload.teamId!,
        });

        visitedTeamName = pick.label;

        visitProvider.onConnectionChange((state) => {
          if (state.connected) {
            statusBar?.setVisitMode(visitedTeamName!);
          }
        });

        visitProvider.onAwarenessChange((states) => {
          campfirePanel?.updateAwareness(states);
        });

        visitProvider.onActivityChange((events) => {
          campfirePanel?.updateActivityFeed(events);
        });

        visitProvider.connect();
        campfirePanel?.setVisitMode(pick.label);
        statusBar?.setVisitMode(pick.label);

        vscode.window.showInformationMessage(`Visiting ${pick.label} campfire`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to visit campfire: ${error}`);
      }
    }),
  );

  // Leave visited campfire
  context.subscriptions.push(
    vscode.commands.registerCommand('campfires.leaveVisit', () => {
      if (!visitProvider) {
        vscode.window.showInformationMessage('Not currently visiting any campfire');
        return;
      }

      visitProvider.dispose();
      visitProvider = null;
      visitedTeamName = null;

      // Restore home team data in panel
      campfirePanel?.clearVisitMode();
      statusBar?.clearVisitMode();

      // Re-push home awareness to panel
      if (awarenessProvider) {
        const states = awarenessProvider.getAwarenessStates();
        campfirePanel?.updateAwareness(states);
        const events = awarenessProvider.getActivityFeed();
        campfirePanel?.updateActivityFeed(events);
      }

      vscode.window.showInformationMessage('Returned to your campfire');
    }),
  );
}

async function showLoginFlow(context: vscode.ExtensionContext): Promise<void> {
  const action = await vscode.window.showQuickPick(['Sign In', 'Sign Up'], {
    placeHolder: 'Choose an action',
  });

  if (!action) return;

  const email = await vscode.window.showInputBox({
    prompt: 'Enter your email',
    placeHolder: 'you@example.com',
  });
  if (!email) return;

  const password = await vscode.window.showInputBox({
    prompt: 'Enter your password',
    password: true,
  });
  if (!password) return;

  let displayName: string | undefined;
  if (action === 'Sign Up') {
    displayName = await vscode.window.showInputBox({
      prompt: 'Enter your display name',
      placeHolder: 'Your Name',
    });
    if (!displayName) return;
  }

  try {
    const serverUrl = getServerUrl();
    const endpoint = action === 'Sign Up' ? '/api/auth/signup' : '/api/auth/login';
    const body = action === 'Sign Up' ? { email, password, displayName } : { email, password };

    const response = await fetch(`${serverUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string };
      throw new Error(errorData.error || 'Authentication failed');
    }

    const { token, user } = (await response.json()) as {
      token: string;
      user: { userId: string; displayName: string; teamId: string; avatarColor: string };
    };

    // Store credentials
    await context.secrets.store(SECRET_KEY_TOKEN, token);
    await context.secrets.store(SECRET_KEY_USER, JSON.stringify(user));

    if (user.teamId) {
      await connect(context, token, user);
      vscode.window.showInformationMessage('Signed in to Campfires!');
    } else {
      statusBar?.showNotConnected();
      vscode.window.showInformationMessage('Signed in! Use "Campfires: Join Team" to join a team.');
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Authentication failed: ${error}`);
  }
}

async function connect(
  context: vscode.ExtensionContext,
  token: string,
  user: { userId: string; displayName: string; teamId: string; avatarColor: string },
): Promise<void> {
  if (!user.teamId) {
    statusBar?.showNotConnected();
    return;
  }

  const serverUrl = getServerUrl();

  // Create awareness provider
  awarenessProvider = new AwarenessProvider({
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
  idleDetector = new IdleDetector((isIdle) => {
    awarenessProvider?.setIdle(isIdle);
  });
  context.subscriptions.push(idleDetector);

  // Set up git watcher
  gitWatcher = new GitWatcher((event) => {
    if (event.type === 'commit') {
      awarenessProvider?.pushActivityEvent('commit', {
        branch: event.branch,
        message: event.message,
      });
    } else if (event.type === 'branch_switch') {
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

function setupFileWatchers(context: vscode.ExtensionContext): void {
  // Active editor change (file open)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || !awarenessProvider) return;

      const relativePath = getRelativePath(editor.document.uri);
      awarenessProvider.setCurrentFile(relativePath);
      awarenessProvider.pushActivityEvent('file_open', { file: relativePath });

      // Update current function
      updateCurrentFunction(editor);
    }),
  );

  // Cursor position change (function detection)
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      updateCurrentFunction(event.textEditor);
    }),
  );

  // File save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!awarenessProvider) return;

      const relativePath = getRelativePath(document.uri);
      awarenessProvider.pushActivityEvent('file_save', { file: relativePath });
    }),
  );

  // Initialize with current editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && awarenessProvider) {
    const relativePath = getRelativePath(activeEditor.document.uri);
    awarenessProvider.setCurrentFile(relativePath);
    updateCurrentFunction(activeEditor);
  }
}

async function updateCurrentFunction(editor: vscode.TextEditor): Promise<void> {
  if (!awarenessProvider) return;

  try {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      editor.document.uri,
    );

    if (!symbols) {
      awarenessProvider.setCurrentFunction(null);
      return;
    }

    const position = editor.selection.active;
    const functionSymbol = findContainingFunction(symbols, position);
    awarenessProvider.setCurrentFunction(functionSymbol?.name || null);
  } catch {
    awarenessProvider.setCurrentFunction(null);
  }
}

function findContainingFunction(
  symbols: vscode.DocumentSymbol[],
  position: vscode.Position,
): vscode.DocumentSymbol | null {
  for (const symbol of symbols) {
    if (!symbol.range.contains(position)) continue;

    // Check if it's a function-like symbol
    if (
      symbol.kind === vscode.SymbolKind.Function ||
      symbol.kind === vscode.SymbolKind.Method ||
      symbol.kind === vscode.SymbolKind.Constructor
    ) {
      // Check children for a more specific match
      const child = findContainingFunction(symbol.children, position);
      return child || symbol;
    }

    // Recurse into children
    const child = findContainingFunction(symbol.children, position);
    if (child) return child;
  }

  return null;
}

function getRelativePath(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return uri.fsPath;
  }
  return vscode.workspace.asRelativePath(uri, false);
}

function getServerUrl(): string {
  const config = vscode.workspace.getConfiguration('campfires');
  return config.get<string>('serverUrl') || DEFAULT_SERVER_URL;
}

async function disconnect(context: vscode.ExtensionContext): Promise<void> {
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

export function deactivate(): void {
  if (visitProvider) {
    visitProvider.dispose();
  }
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
