import * as vscode from 'vscode';
import { CONFIG } from '@campfires/shared';

export type IdleCallback = (isIdle: boolean) => void;

export class IdleDetector implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private isIdle = false;
  private disposables: vscode.Disposable[] = [];
  private callback: IdleCallback;

  constructor(callback: IdleCallback) {
    this.callback = callback;
    this.setupListeners();
    this.resetTimer();
  }

  private setupListeners(): void {
    // Text document changes (typing)
    this.disposables.push(vscode.workspace.onDidChangeTextDocument(() => this.onActivity()));

    // Editor selection changes (cursor movement, scrolling)
    this.disposables.push(vscode.window.onDidChangeTextEditorSelection(() => this.onActivity()));

    // Visible ranges change (scrolling)
    this.disposables.push(
      vscode.window.onDidChangeTextEditorVisibleRanges(() => this.onActivity()),
    );

    // Active editor changes (switching tabs)
    this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.onActivity()));

    // Window focus
    this.disposables.push(
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          this.onActivity();
        }
      }),
    );
  }

  private onActivity(): void {
    if (this.isIdle) {
      this.isIdle = false;
      this.callback(false);
    }
    this.resetTimer();
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.isIdle = true;
      this.callback(true);
    }, CONFIG.IDLE_TIMEOUT);
  }

  public getIsIdle(): boolean {
    return this.isIdle;
  }

  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
