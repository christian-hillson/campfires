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
exports.StatusBar = void 0;
const vscode = __importStar(require("vscode"));
class StatusBar {
    statusBarItem;
    activeCount = 0;
    isDraftMode = false;
    isConnected = false;
    isReconnecting = false;
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'campfires.toggleDraftMode';
        this.update();
        this.statusBarItem.show();
    }
    setActiveCount(count) {
        this.activeCount = count;
        this.update();
    }
    setDraftMode(enabled) {
        this.isDraftMode = enabled;
        this.update();
    }
    setConnectionState(connected, reconnecting = false) {
        this.isConnected = connected;
        this.isReconnecting = reconnecting;
        this.update();
    }
    update() {
        if (this.isReconnecting) {
            this.statusBarItem.text = '$(sync~spin) Campfires: Reconnecting...';
            this.statusBarItem.tooltip = 'Attempting to reconnect to your team campfire';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            return;
        }
        if (!this.isConnected) {
            this.statusBarItem.text = '$(circle-slash) Campfires: Offline';
            this.statusBarItem.tooltip = 'Not connected to your team campfire';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            return;
        }
        const icon = this.isDraftMode ? '$(eye-closed)' : '$(flame)';
        const mode = this.isDraftMode ? 'Draft' : 'Live';
        const countText = this.activeCount === 1 ? '1 dev' : `${this.activeCount} devs`;
        this.statusBarItem.text = `${icon} ${countText} · ${mode}`;
        this.statusBarItem.tooltip = this.isDraftMode
            ? 'You are in draft mode. Your activity is hidden. Click to go live.'
            : `${this.activeCount} team member(s) online. Click to enter draft mode.`;
        this.statusBarItem.backgroundColor = undefined;
    }
    showNotConnected() {
        this.statusBarItem.text = '$(flame) Campfires: Sign In';
        this.statusBarItem.tooltip = 'Click to sign in to Campfires';
        this.statusBarItem.command = 'campfires.login';
        this.statusBarItem.backgroundColor = undefined;
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=status-bar.js.map