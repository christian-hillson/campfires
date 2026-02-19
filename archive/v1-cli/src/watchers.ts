import { watch, existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import type { FSWatcher } from 'node:fs';
import { CLI_CONFIG } from './types.js';

// ============================================
// GitWatcher — detects branch switches & commits
// ============================================

export interface GitWatcherEvents {
  onCommit: (hash: string, message: string) => void;
  onBranchSwitch: (branch: string) => void;
}

export class GitWatcher {
  private headWatcher: FSWatcher | null = null;
  private refWatcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBranch: string | null = null;
  private currentCommit: string | null = null;
  private gitDir: string;

  constructor(
    private workDir: string,
    private events: GitWatcherEvents,
  ) {
    this.gitDir = join(workDir, '.git');
  }

  async start(): Promise<void> {
    if (!existsSync(this.gitDir)) return;

    // Read initial state
    this.currentBranch = await this.getBranch();
    this.currentCommit = await this.getCommitHash();

    this.watchHead();
    if (this.currentBranch) {
      this.watchRef(this.currentBranch);
    }
  }

  dispose(): void {
    this.headWatcher?.close();
    this.refWatcher?.close();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.headWatcher = null;
    this.refWatcher = null;
  }

  private watchHead(): void {
    const headPath = join(this.gitDir, 'HEAD');
    if (!existsSync(headPath)) return;

    this.headWatcher = watch(headPath, () => {
      this.debounce(() => this.handleHeadChange());
    });
  }

  private watchRef(branch: string): void {
    this.refWatcher?.close();
    this.refWatcher = null;

    const refPath = join(this.gitDir, 'refs', 'heads', branch);
    if (!existsSync(refPath)) return;

    this.refWatcher = watch(refPath, () => {
      this.debounce(() => this.handleRefChange());
    });
  }

  private debounce(fn: () => void): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(fn, CLI_CONFIG.GIT_DEBOUNCE);
  }

  private async handleHeadChange(): Promise<void> {
    const branch = await this.getBranch();
    if (!branch || branch === this.currentBranch) return;

    const prevBranch = this.currentBranch;
    this.currentBranch = branch;
    this.currentCommit = await this.getCommitHash();

    // Re-watch the new branch's ref file
    this.watchRef(branch);

    if (prevBranch !== null) {
      this.events.onBranchSwitch(branch);
    }
  }

  private async handleRefChange(): Promise<void> {
    const hash = await this.getCommitHash();
    if (!hash || hash === this.currentCommit) return;

    this.currentCommit = hash;
    const message = await this.getCommitMessage();
    this.events.onCommit(hash, message);
  }

  private getBranch(): Promise<string | null> {
    return this.gitExec(['rev-parse', '--abbrev-ref', 'HEAD']);
  }

  private getCommitHash(): Promise<string | null> {
    return this.gitExec(['rev-parse', 'HEAD']);
  }

  private async getCommitMessage(): Promise<string> {
    return (await this.gitExec(['log', '-1', '--format=%s'])) || 'committed';
  }

  private gitExec(args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      execFile('git', args, { cwd: this.workDir }, (err, stdout) => {
        if (err) return resolve(null);
        resolve(stdout.trim() || null);
      });
    });
  }

  getCurrentBranch(): string | null {
    return this.currentBranch;
  }
}

// ============================================
// FileWatcher — detects file saves
// ============================================

export interface FileWatcherEvents {
  onFileSave: (relativePath: string) => void;
}

export class FileWatcher {
  private watcher: FSWatcher | null = null;

  constructor(
    private workDir: string,
    private events: FileWatcherEvents,
  ) {}

  start(): void {
    this.watcher = watch(this.workDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      if (this.isIgnored(filename)) return;

      // Only emit for files that still exist (filters out deletes)
      const fullPath = join(this.workDir, filename);
      try {
        if (!statSync(fullPath).isFile()) return;
      } catch {
        return; // File was deleted or inaccessible
      }

      this.events.onFileSave(filename);
    });
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private isIgnored(filePath: string): boolean {
    const segments = filePath.split('/');
    const ignore: readonly string[] = CLI_CONFIG.FILE_WATCH_IGNORE;
    return segments.some((seg) => ignore.includes(seg));
  }
}
