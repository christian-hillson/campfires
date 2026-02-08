import * as vscode from 'vscode';
export declare class StatusBar implements vscode.Disposable {
    private statusBarItem;
    private activeCount;
    private isDraftMode;
    private isConnected;
    private isReconnecting;
    constructor();
    setActiveCount(count: number): void;
    setDraftMode(enabled: boolean): void;
    setConnectionState(connected: boolean, reconnecting?: boolean): void;
    private update;
    showNotConnected(): void;
    dispose(): void;
}
