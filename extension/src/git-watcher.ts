import * as vscode from 'vscode';

// Git extension API types
interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
  onDidOpenRepository: vscode.Event<Repository>;
}

interface Repository {
  state: RepositoryState;
  onDidChangeState: vscode.Event<void>;
}

interface RepositoryState {
  HEAD: Branch | undefined;
  refs: Ref[];
}

interface Branch {
  name: string | undefined;
  commit: string | undefined;
  upstream?: { name: string; remote: string };
}

interface Ref {
  type: number;
  name: string | undefined;
  commit: string | undefined;
}

export interface GitEvent {
  type: 'commit' | 'branch_switch';
  branch: string;
  message?: string;
  commitHash?: string;
}

export type GitEventCallback = (event: GitEvent) => void;

export class GitWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private gitApi: GitAPI | null = null;
  private callback: GitEventCallback;
  private lastBranch: string | null = null;
  private lastCommit: string | null = null;

  constructor(callback: GitEventCallback) {
    this.callback = callback;
    this.initGitExtension();
  }

  private async initGitExtension(): Promise<void> {
    try {
      const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
      if (!gitExtension) {
        console.log('Git extension not found');
        return;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      this.gitApi = gitExtension.exports.getAPI(1);
      this.watchRepositories();
    } catch (error) {
      console.error('Failed to initialize git extension:', error);
    }
  }

  private watchRepositories(): void {
    if (!this.gitApi) return;

    // Watch existing repositories
    for (const repo of this.gitApi.repositories) {
      this.watchRepository(repo);
    }

    // Watch for new repositories
    this.disposables.push(
      this.gitApi.onDidOpenRepository((repo) => {
        this.watchRepository(repo);
      })
    );
  }

  private watchRepository(repo: Repository): void {
    // Initialize tracking state
    if (repo.state.HEAD) {
      this.lastBranch = repo.state.HEAD.name || null;
      this.lastCommit = repo.state.HEAD.commit || null;
    }

    // Watch for state changes
    this.disposables.push(
      repo.onDidChangeState(() => {
        this.handleStateChange(repo);
      })
    );
  }

  private handleStateChange(repo: Repository): void {
    const currentBranch = repo.state.HEAD?.name || null;
    const currentCommit = repo.state.HEAD?.commit || null;

    // Check for branch switch
    if (currentBranch && currentBranch !== this.lastBranch) {
      this.callback({
        type: 'branch_switch',
        branch: currentBranch,
      });
      this.lastBranch = currentBranch;
    }

    // Check for new commit
    if (currentCommit && currentCommit !== this.lastCommit) {
      // Try to get commit message (this is a simplified approach)
      this.callback({
        type: 'commit',
        branch: currentBranch || 'unknown',
        commitHash: currentCommit,
      });
      this.lastCommit = currentCommit;
    }
  }

  public getCurrentBranch(): string | null {
    if (!this.gitApi || this.gitApi.repositories.length === 0) {
      return null;
    }

    const repo = this.gitApi.repositories[0];
    return repo.state.HEAD?.name || null;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
