import * as vscode from 'vscode';
import type { AwarenessState } from '@campfires/shared';

interface TeammatePresence {
  userId: string;
  displayName: string;
  color: string;
  currentFunction: string | null;
}

export class DecorationManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private gutterDecorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
  private currentDecorations: Map<string, vscode.TextEditorDecorationType[]> = new Map();
  private filePresence: Map<string, TeammatePresence[]> = new Map();

  constructor() {
    // Re-apply decorations when active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.applyDecorations();
      })
    );
  }

  public updatePresence(states: Map<number, AwarenessState>, currentUserId: string): void {
    // Clear existing presence
    this.filePresence.clear();

    // Build file -> teammates map
    states.forEach((state) => {
      if (state.userId === currentUserId) return; // Skip self
      if (state.status === 'offline' || state.status === 'draft') return;
      if (!state.currentFile) return;

      const file = state.currentFile;
      if (!this.filePresence.has(file)) {
        this.filePresence.set(file, []);
      }

      this.filePresence.get(file)!.push({
        userId: state.userId,
        displayName: state.displayName,
        color: state.color,
        currentFunction: state.currentFunction,
      });
    });

    this.applyDecorations();
  }

  private applyDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Get relative path for current file
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const teammates = this.filePresence.get(relativePath) || [];

    // Clear existing decorations for this editor
    this.clearDecorationsForEditor(editor);

    if (teammates.length === 0) return;

    // Create decorations for each teammate
    teammates.forEach((teammate, _index) => {
      const decorationType = this.getOrCreateDecorationType(teammate.color);

      // Add gutter decoration at line 0 (or where they are if we had line info)
      const range = new vscode.Range(0, 0, 0, 0);
      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.appendMarkdown(`**${teammate.displayName}** is here`);
      if (teammate.currentFunction) {
        hoverMessage.appendMarkdown(`\n\nIn function: \`${teammate.currentFunction}\``);
      }

      editor.setDecorations(decorationType, [
        {
          range,
          hoverMessage,
        },
      ]);

      // Track decorations for cleanup
      const key = editor.document.uri.toString();
      if (!this.currentDecorations.has(key)) {
        this.currentDecorations.set(key, []);
      }
      this.currentDecorations.get(key)!.push(decorationType);
    });
  }

  private getOrCreateDecorationType(color: string): vscode.TextEditorDecorationType {
    if (this.gutterDecorationTypes.has(color)) {
      return this.gutterDecorationTypes.get(color)!;
    }

    const decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createColoredCircleSvg(color),
      gutterIconSize: '80%',
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    this.gutterDecorationTypes.set(color, decorationType);
    return decorationType;
  }

  private createColoredCircleSvg(color: string): vscode.Uri {
    // Create an inline SVG data URI for a colored circle
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="${color}" opacity="0.8"/>
    </svg>`;
    const encoded = Buffer.from(svg).toString('base64');
    return vscode.Uri.parse(`data:image/svg+xml;base64,${encoded}`);
  }

  private clearDecorationsForEditor(editor: vscode.TextEditor): void {
    const key = editor.document.uri.toString();
    const decorations = this.currentDecorations.get(key) || [];

    decorations.forEach((d) => {
      editor.setDecorations(d, []);
    });

    this.currentDecorations.delete(key);
  }

  public clearAllDecorations(): void {
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.clearDecorationsForEditor(editor);
    });
  }

  public getTeammatesInFile(relativePath: string): TeammatePresence[] {
    return this.filePresence.get(relativePath) || [];
  }

  public dispose(): void {
    this.clearAllDecorations();
    this.gutterDecorationTypes.forEach((d) => d.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
