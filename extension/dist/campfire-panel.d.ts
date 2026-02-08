import * as vscode from 'vscode';
import type { AwarenessState, ActivityEvent } from '@campfires/shared';
export declare class CampfirePanel implements vscode.WebviewViewProvider {
    private readonly extensionUri;
    static readonly viewType = "campfires.panel";
    private view?;
    private awarenessStates;
    private activityEvents;
    private currentUserId;
    private currentUserName;
    private userNames;
    private filterConfig;
    constructor(extensionUri: vscode.Uri);
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    setCurrentUser(userId: string, displayName: string): void;
    updateAwareness(states: Map<number, AwarenessState>): void;
    updateActivityFeed(events: ActivityEvent[]): void;
    private refresh;
    private getFilteredTeammates;
    private getFilteredEvents;
    private openFile;
    private getHtmlContent;
    dispose(): void;
}
