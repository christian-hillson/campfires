import * as vscode from 'vscode';
import type { AwarenessState, ActivityEvent, FilterConfig } from '@campfires/shared';

export class CampfirePanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'campfires.panel';

  private view?: vscode.WebviewView;
  private awarenessStates: Map<number, AwarenessState> = new Map();
  private activityEvents: ActivityEvent[] = [];
  private currentUserId: string = '';
  private currentUserName: string = '';
  private userNames: Map<string, string> = new Map();
  private filterConfig: FilterConfig = {
    users: [],
    directories: [],
    eventTypes: [],
    focusMode: false,
  };
  private visitingTeamName: string | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'filter':
          this.filterConfig = message.config;
          this.refresh();
          break;
        case 'openFile':
          this.openFile(message.file);
          break;
        case 'leaveVisit':
          vscode.commands.executeCommand('campfires.leaveVisit');
          break;
      }
    });

    // Initial render
    this.refresh();
  }

  public setCurrentUser(userId: string, displayName: string): void {
    this.currentUserId = userId;
    this.currentUserName = displayName;
    this.userNames.set(userId, displayName);
    this.refresh();
  }

  public updateAwareness(states: Map<number, AwarenessState>): void {
    this.awarenessStates = states;
    // Build userNames map from awareness states
    states.forEach((state) => {
      this.userNames.set(state.userId, state.displayName);
    });
    this.refresh();
  }

  public updateActivityFeed(events: ActivityEvent[]): void {
    this.activityEvents = events;
    this.refresh();
  }

  public setVisitMode(teamName: string): void {
    this.visitingTeamName = teamName;
    this.refresh();
  }

  public clearVisitMode(): void {
    this.visitingTeamName = null;
    this.refresh();
  }

  private refresh(): void {
    if (!this.view) return;

    const teammates = this.getFilteredTeammates();
    const events = this.getFilteredEvents();

    this.view.webview.postMessage({
      type: 'update',
      teammates,
      events: events.slice(0, 50), // Last 50 events
      currentUserId: this.currentUserId,
      currentUserName: this.currentUserName,
      userNames: Object.fromEntries(this.userNames),
      filterConfig: this.filterConfig,
      visitingTeamName: this.visitingTeamName,
    });
  }

  private getFilteredTeammates(): AwarenessState[] {
    const teammates: AwarenessState[] = [];

    this.awarenessStates.forEach((state) => {
      if (state.userId === this.currentUserId) return; // Exclude self
      if (state.status === 'offline') return;

      // Apply user filter
      if (this.filterConfig.users.length > 0) {
        if (!this.filterConfig.users.includes(state.userId)) return;
      }

      // Apply directory filter
      if (this.filterConfig.directories.length > 0 && state.currentFile) {
        const matchesDir = this.filterConfig.directories.some((dir) =>
          state.currentFile!.startsWith(dir),
        );
        if (!matchesDir) return;
      }

      teammates.push(state);
    });

    // Sort by status (active first, then idle, then draft, visitor, offline)
    return teammates.sort((a, b) => {
      const order: Record<string, number> = {
        active: 0,
        idle: 1,
        draft: 2,
        visitor: 3,
        offline: 4,
      };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });
  }

  private getFilteredEvents(): ActivityEvent[] {
    let events = [...this.activityEvents];

    // Apply user filter
    if (this.filterConfig.users.length > 0) {
      events = events.filter((e) => this.filterConfig.users.includes(e.userId));
    }

    // Apply directory filter
    if (this.filterConfig.directories.length > 0) {
      events = events.filter((e) => {
        if (!e.file) return false;
        return this.filterConfig.directories.some((dir) => e.file!.startsWith(dir));
      });
    }

    // Apply event type filter
    if (this.filterConfig.eventTypes.length > 0) {
      events = events.filter((e) => this.filterConfig.eventTypes.includes(e.type));
    }

    // Sort by timestamp descending
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async openFile(file: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, file);
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch {
      vscode.window.showWarningMessage(`Could not open file: ${file}`);
    }
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Campfires</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 8px;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-header {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      font-weight: 600;
    }
    .teammate {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      background: var(--vscode-list-hoverBackground);
    }
    .teammate:hover {
      background: var(--vscode-list-activeSelectionBackground);
    }
    .avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      margin-right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      color: white;
    }
    .teammate-info {
      flex: 1;
      min-width: 0;
    }
    .teammate-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .teammate-location {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    .status-active { background: #28a745; color: white; }
    .status-idle { background: #ffc107; color: black; }
    .status-draft { background: #6c757d; color: white; }
    .status-visitor { background: #58a6ff; color: white; }

    .visit-banner {
      display: none;
      background: var(--vscode-inputValidation-infoBackground, #063b49);
      border: 1px solid var(--vscode-inputValidation-infoBorder, #007acc);
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .visit-banner.active { display: block; }
    .visit-banner-text { margin-bottom: 6px; }
    .visit-banner button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }

    .event {
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      background: var(--vscode-list-hoverBackground);
      cursor: pointer;
    }
    .event:hover {
      background: var(--vscode-list-activeSelectionBackground);
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .event-user {
      font-weight: 500;
    }
    .event-time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .event-content {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .event-type {
      display: inline-block;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 4px;
    }
    .type-file_open { background: #17a2b8; color: white; }
    .type-file_save { background: #28a745; color: white; }
    .type-commit { background: #6f42c1; color: white; }
    .type-branch_switch { background: #fd7e14; color: white; }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--vscode-descriptionForeground);
    }
    .filters {
      margin-bottom: 12px;
      padding: 8px;
      background: var(--vscode-input-background);
      border-radius: 4px;
    }
    .filter-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .filter-chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      cursor: pointer;
    }
    .filter-chip.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="visit-banner" id="visit-banner">
      <div class="visit-banner-text" id="visit-banner-text"></div>
      <button onclick="leaveVisit()">Leave Visit</button>
    </div>
    <div class="section">
      <div class="section-header">Team</div>
      <div id="teammates"></div>
    </div>

    <div class="section">
      <div class="section-header">Activity</div>
      <div id="events"></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let state = { teammates: [], events: [], currentUserId: '' };

    function esc(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'update') {
        state = message;
        render();
      }
    });

    function render() {
      renderVisitBanner();
      renderTeammates();
      renderEvents();
    }

    function renderVisitBanner() {
      const banner = document.getElementById('visit-banner');
      const text = document.getElementById('visit-banner-text');
      if (state.visitingTeamName) {
        banner.classList.add('active');
        text.textContent = 'Visiting: ' + state.visitingTeamName;
      } else {
        banner.classList.remove('active');
      }
    }

    function leaveVisit() {
      vscode.postMessage({ type: 'leaveVisit' });
    }

    function renderTeammates() {
      const container = document.getElementById('teammates');

      if (state.teammates.length === 0) {
        container.innerHTML = '<div class="empty-state">No teammates online</div>';
        return;
      }

      container.innerHTML = state.teammates.map(t => \`
        <div class="teammate">
          <div class="avatar" style="background: \${esc(t.color)}">\${esc(t.displayName.charAt(0).toUpperCase())}</div>
          <div class="teammate-info">
            <div class="teammate-name">\${esc(t.displayName)}</div>
            <div class="teammate-location">\${esc(t.currentFile || 'No file open')}\${t.currentFunction ? ' · ' + esc(t.currentFunction) : ''}</div>
          </div>
          <span class="status-badge status-\${esc(t.status)}">\${esc(t.status)}</span>
        </div>
      \`).join('');
    }

    function renderEvents() {
      const container = document.getElementById('events');

      if (state.events.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent activity</div>';
        return;
      }

      container.innerHTML = state.events.map(e => \`
        <div class="event" data-file="\${esc(e.file || '')}">
          <div class="event-header">
            <span class="event-user">\${esc(getUserName(e.userId))}</span>
            <span class="event-time">\${formatTime(e.timestamp)}</span>
          </div>
          <div class="event-content">
            <span class="event-type type-\${esc(e.type)}">\${esc(formatEventType(e.type))}</span>
            \${esc(e.file || '')}\${e.message ? ' · ' + esc(e.message) : ''}
          </div>
        </div>
      \`).join('');

      // Bind click handlers safely (avoids inline JS injection via file names)
      container.querySelectorAll('.event[data-file]').forEach(el => {
        el.addEventListener('click', () => openFile(el.getAttribute('data-file')));
      });
    }

    function getUserName(userId) {
      if (state.userNames && state.userNames[userId]) {
        return state.userNames[userId];
      }
      const teammate = state.teammates.find(t => t.userId === userId);
      return teammate ? teammate.displayName : userId.slice(0, 8);
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return date.toLocaleDateString();
    }

    function formatEventType(type) {
      const labels = {
        file_open: 'opened',
        file_save: 'saved',
        commit: 'commit',
        branch_switch: 'switched',
        session_start: 'joined',
        session_end: 'left'
      };
      return labels[type] || type;
    }

    function openFile(file) {
      if (file) {
        vscode.postMessage({ type: 'openFile', file });
      }
    }
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    // Nothing to dispose
  }
}
