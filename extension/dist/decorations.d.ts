import * as vscode from 'vscode';
import type { AwarenessState } from '@campfires/shared';
interface TeammatePresence {
    userId: string;
    displayName: string;
    color: string;
    currentFunction: string | null;
}
export declare class DecorationManager implements vscode.Disposable {
    private disposables;
    private gutterDecorationTypes;
    private currentDecorations;
    private filePresence;
    constructor();
    updatePresence(states: Map<number, AwarenessState>, currentUserId: string): void;
    private applyDecorations;
    private getOrCreateDecorationType;
    private createColoredCircleSvg;
    private clearDecorationsForEditor;
    clearAllDecorations(): void;
    getTeammatesInFile(relativePath: string): TeammatePresence[];
    dispose(): void;
}
export {};
