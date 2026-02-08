import * as vscode from 'vscode';
export type IdleCallback = (isIdle: boolean) => void;
export declare class IdleDetector implements vscode.Disposable {
    private timer;
    private isIdle;
    private disposables;
    private callback;
    constructor(callback: IdleCallback);
    private setupListeners;
    private onActivity;
    private resetTimer;
    getIsIdle(): boolean;
    dispose(): void;
}
