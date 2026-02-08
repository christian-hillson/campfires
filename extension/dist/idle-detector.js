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
exports.IdleDetector = void 0;
const vscode = __importStar(require("vscode"));
const shared_1 = require("@campfires/shared");
class IdleDetector {
    timer = null;
    isIdle = false;
    disposables = [];
    callback;
    constructor(callback) {
        this.callback = callback;
        this.setupListeners();
        this.resetTimer();
    }
    setupListeners() {
        // Text document changes (typing)
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(() => this.onActivity()));
        // Editor selection changes (cursor movement, scrolling)
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection(() => this.onActivity()));
        // Visible ranges change (scrolling)
        this.disposables.push(vscode.window.onDidChangeTextEditorVisibleRanges(() => this.onActivity()));
        // Active editor changes (switching tabs)
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.onActivity()));
        // Window focus
        this.disposables.push(vscode.window.onDidChangeWindowState((state) => {
            if (state.focused) {
                this.onActivity();
            }
        }));
    }
    onActivity() {
        if (this.isIdle) {
            this.isIdle = false;
            this.callback(false);
        }
        this.resetTimer();
    }
    resetTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.isIdle = true;
            this.callback(true);
        }, shared_1.CONFIG.IDLE_TIMEOUT);
    }
    getIsIdle() {
        return this.isIdle;
    }
    dispose() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.IdleDetector = IdleDetector;
//# sourceMappingURL=idle-detector.js.map