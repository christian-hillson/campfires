"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitWatcher = void 0;
const vscode = __importStar(require("vscode"));
class GitWatcher {
    disposables = [];
    gitApi = null;
    callback;
    lastBranch = null;
    lastCommit = null;
    constructor(callback) {
        this.callback = callback;
        this.initGitExtension();
    }
    async initGitExtension() {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                console.log('Git extension not found');
                return;
            }
            if (!gitExtension.isActive) {
                await gitExtension.activate();
            }
            this.gitApi = gitExtension.exports.getAPI(1);
            this.watchRepositories();
        }
        catch (error) {
            console.error('Failed to initialize git extension:', error);
        }
    }
    watchRepositories() {
        if (!this.gitApi)
            return;
        // Watch existing repositories
        for (const repo of this.gitApi.repositories) {
            this.watchRepository(repo);
        }
        // Watch for new repositories
        this.disposables.push(this.gitApi.onDidOpenRepository((repo) => {
            this.watchRepository(repo);
        }));
    }
    watchRepository(repo) {
        // Initialize tracking state
        if (repo.state.HEAD) {
            this.lastBranch = repo.state.HEAD.name || null;
            this.lastCommit = repo.state.HEAD.commit || null;
        }
        // Watch for state changes
        this.disposables.push(repo.onDidChangeState(() => {
            this.handleStateChange(repo);
        }));
    }
    handleStateChange(repo) {
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
    getCurrentBranch() {
        if (!this.gitApi || this.gitApi.repositories.length === 0) {
            return null;
        }
        const repo = this.gitApi.repositories[0];
        return repo.state.HEAD?.name || null;
    }
    dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.GitWatcher = GitWatcher;
//# sourceMappingURL=git-watcher.js.map