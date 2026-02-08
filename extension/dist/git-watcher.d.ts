import * as vscode from 'vscode';
export interface GitEvent {
    type: 'commit' | 'branch_switch';
    branch: string;
    message?: string;
    commitHash?: string;
}
export type GitEventCallback = (event: GitEvent) => void;
export declare class GitWatcher implements vscode.Disposable {
    private disposables;
    private gitApi;
    private callback;
    private lastBranch;
    private lastCommit;
    constructor(callback: GitEventCallback);
    private initGitExtension;
    private watchRepositories;
    private watchRepository;
    private handleStateChange;
    getCurrentBranch(): string | null;
    dispose(): void;
}
