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
exports.AwarenessProvider = void 0;
const Y = __importStar(require("yjs"));
const y_websocket_1 = require("y-websocket");
class AwarenessProvider {
    doc;
    provider = null;
    activityFeed;
    disposables = [];
    userId;
    displayName;
    teamId;
    token;
    serverUrl;
    color;
    isDraftMode = false;
    isIdle = false;
    currentFile = null;
    currentFunction = null;
    currentBranch = null;
    connectionCallbacks = new Set();
    awarenessCallbacks = new Set();
    activityCallbacks = new Set();
    // Throttling state
    lastFileSave = new Map();
    lastFileOpen = new Map();
    constructor(options) {
        this.userId = options.userId;
        this.displayName = options.displayName;
        this.teamId = options.teamId;
        this.token = options.token;
        this.serverUrl = options.serverUrl;
        this.color = options.color;
        this.doc = new Y.Doc();
        this.activityFeed = this.doc.getArray('activityFeed');
        this.setupActivityListener();
    }
    connect() {
        const wsUrl = this.serverUrl.replace(/^http/, 'ws');
        const roomName = `campfire:${this.teamId}`;
        this.provider = new y_websocket_1.WebsocketProvider(wsUrl, roomName, this.doc, {
            params: { token: this.token },
        });
        this.provider.on('status', (event) => {
            const connected = event.status === 'connected';
            this.notifyConnectionCallbacks({
                connected,
                reconnecting: event.status === 'connecting',
            });
        });
        this.provider.awareness.on('change', () => {
            this.notifyAwarenessCallbacks();
        });
        // Broadcast initial awareness state
        this.updateAwareness();
    }
    setupActivityListener() {
        this.activityFeed.observe(() => {
            const events = this.activityFeed.toArray();
            this.notifyActivityCallbacks(events);
        });
    }
    disconnect() {
        if (this.provider) {
            // Send session end event
            this.pushActivityEvent('session_end');
            this.provider.awareness.setLocalState(null);
            this.provider.disconnect();
            this.provider = null;
        }
    }
    // ============================================
    // Awareness State Management
    // ============================================
    updateAwareness() {
        if (!this.provider)
            return;
        const state = {
            userId: this.userId,
            displayName: this.displayName,
            type: 'human',
            status: this.getStatus(),
            currentFile: this.isDraftMode ? null : this.currentFile,
            currentFunction: this.isDraftMode ? null : this.currentFunction,
            currentBranch: this.isDraftMode ? null : this.currentBranch,
            lastActivity: new Date().toISOString(),
            color: this.color,
        };
        this.provider.awareness.setLocalState(state);
    }
    getStatus() {
        if (this.isDraftMode)
            return 'draft';
        if (this.isIdle)
            return 'idle';
        return 'active';
    }
    setDraftMode(enabled) {
        this.isDraftMode = enabled;
        this.updateAwareness();
    }
    setIdle(idle) {
        this.isIdle = idle;
        this.updateAwareness();
    }
    setCurrentFile(file) {
        this.currentFile = file;
        this.updateAwareness();
    }
    setCurrentFunction(func) {
        this.currentFunction = func;
        this.updateAwareness();
    }
    setCurrentBranch(branch) {
        this.currentBranch = branch;
        this.updateAwareness();
    }
    getDraftMode() {
        return this.isDraftMode;
    }
    // ============================================
    // Activity Event Management
    // ============================================
    pushActivityEvent(type, options = {}) {
        if (this.isDraftMode && type !== 'session_start' && type !== 'session_end') {
            return; // Don't log activity in draft mode
        }
        // Apply throttling
        if (!this.shouldEmitEvent(type, options.file)) {
            return;
        }
        const event = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            userId: this.userId,
            userType: 'human',
            teamId: this.teamId,
            type,
            file: options.file || null,
            branch: options.branch || this.currentBranch,
            message: options.message || null,
            metadata: options.metadata || null,
        };
        this.activityFeed.push([event]);
    }
    shouldEmitEvent(type, file) {
        const now = Date.now();
        switch (type) {
            case 'file_save': {
                if (!file)
                    return true;
                const lastSave = this.lastFileSave.get(file) || 0;
                if (now - lastSave < 5000)
                    return false; // 5 second throttle
                this.lastFileSave.set(file, now);
                return true;
            }
            case 'file_open': {
                if (!file)
                    return true;
                const lastOpen = this.lastFileOpen.get(file) || 0;
                if (now - lastOpen < 2000)
                    return false; // 2 second throttle
                this.lastFileOpen.set(file, now);
                return true;
            }
            default:
                return true; // No throttling for commits, branch switches, session events
        }
    }
    // ============================================
    // Getters for state
    // ============================================
    getAwarenessStates() {
        if (!this.provider)
            return new Map();
        return this.provider.awareness.getStates();
    }
    getActivityFeed() {
        return this.activityFeed.toArray();
    }
    getConnectedCount() {
        if (!this.provider)
            return 0;
        return this.provider.awareness.getStates().size;
    }
    isConnected() {
        return this.provider?.wsconnected || false;
    }
    // ============================================
    // Callback Registration
    // ============================================
    onConnectionChange(callback) {
        this.connectionCallbacks.add(callback);
    }
    offConnectionChange(callback) {
        this.connectionCallbacks.delete(callback);
    }
    onAwarenessChange(callback) {
        this.awarenessCallbacks.add(callback);
    }
    offAwarenessChange(callback) {
        this.awarenessCallbacks.delete(callback);
    }
    onActivityChange(callback) {
        this.activityCallbacks.add(callback);
    }
    offActivityChange(callback) {
        this.activityCallbacks.delete(callback);
    }
    notifyConnectionCallbacks(state) {
        this.connectionCallbacks.forEach((cb) => cb(state));
    }
    notifyAwarenessCallbacks() {
        const states = this.getAwarenessStates();
        this.awarenessCallbacks.forEach((cb) => cb(states));
    }
    notifyActivityCallbacks(events) {
        this.activityCallbacks.forEach((cb) => cb(events));
    }
    dispose() {
        this.disconnect();
        this.disposables.forEach((d) => d.dispose());
        this.doc.destroy();
    }
}
exports.AwarenessProvider = AwarenessProvider;
//# sourceMappingURL=awareness-provider.js.map