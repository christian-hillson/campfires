import * as vscode from 'vscode';

export class StatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private activeCount = 0;
  private isDraftMode = false;
  private isConnected = false;
  private isReconnecting = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'campfires.toggleDraftMode';
    this.update();
    this.statusBarItem.show();
  }

  public setActiveCount(count: number): void {
    this.activeCount = count;
    this.update();
  }

  public setDraftMode(enabled: boolean): void {
    this.isDraftMode = enabled;
    this.update();
  }

  public setConnectionState(connected: boolean, reconnecting: boolean = false): void {
    this.isConnected = connected;
    this.isReconnecting = reconnecting;
    this.update();
  }

  private update(): void {
    if (this.isReconnecting) {
      this.statusBarItem.text = '$(sync~spin) Campfires: Reconnecting...';
      this.statusBarItem.tooltip = 'Attempting to reconnect to your team campfire';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
      return;
    }

    if (!this.isConnected) {
      this.statusBarItem.text = '$(circle-slash) Campfires: Offline';
      this.statusBarItem.tooltip = 'Not connected to your team campfire';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
      return;
    }

    const icon = this.isDraftMode ? '$(eye-closed)' : '$(flame)';
    const mode = this.isDraftMode ? 'Draft' : 'Live';
    const countText = this.activeCount === 1 ? '1 dev' : `${this.activeCount} devs`;

    this.statusBarItem.text = `${icon} ${countText} · ${mode}`;
    this.statusBarItem.tooltip = this.isDraftMode
      ? 'You are in draft mode. Your activity is hidden. Click to go live.'
      : `${this.activeCount} team member(s) online. Click to enter draft mode.`;
    this.statusBarItem.backgroundColor = undefined;
  }

  public showNotConnected(): void {
    this.statusBarItem.text = '$(flame) Campfires: Sign In';
    this.statusBarItem.tooltip = 'Click to sign in to Campfires';
    this.statusBarItem.command = 'campfires.login';
    this.statusBarItem.backgroundColor = undefined;
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
