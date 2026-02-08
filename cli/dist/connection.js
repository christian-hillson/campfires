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
exports.CampfireConnection = void 0;
const Y = __importStar(require("yjs"));
const y_websocket_1 = require("y-websocket");
const types_js_1 = require("./types.js");
class CampfireConnection {
    serverUrl;
    teamId;
    token;
    userId;
    displayName;
    color;
    doc;
    provider = null;
    activityFeed;
    refreshInterval = null;
    connectionCallbacks = new Set();
    awarenessCallbacks = new Set();
    activityCallbacks = new Set();
    constructor(serverUrl, teamId, token, userId, displayName, color) {
        this.serverUrl = serverUrl;
        this.teamId = teamId;
        this.token = token;
        this.userId = userId;
        this.displayName = displayName;
        this.color = color;
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
            this.notifyConnection({
                connected,
                reconnecting: event.status === 'connecting',
            });
        });
        this.provider.awareness.on('change', () => {
            this.notifyAwareness();
        });
        // Broadcast initial awareness
        this.updateAwareness();
        // Refresh lastActivity periodically to stay within AWARENESS_TIMEOUT
        this.refreshInterval = setInterval(() => {
            this.updateAwareness();
        }, types_js_1.CLI_CONFIG.AWARENESS_REFRESH);
    }
    updateAwareness() {
        if (!this.provider)
            return;
        const state = {
            userId: this.userId,
            displayName: this.displayName,
            type: 'human',
            status: 'active',
            currentFile: null,
            currentFunction: null,
            currentBranch: null,
            lastActivity: new Date().toISOString(),
            color: this.color,
        };
        this.provider.awareness.setLocalState(state);
    }
    setupActivityListener() {
        this.activityFeed.observe(() => {
            const events = this.activityFeed.toArray();
            this.notifyActivity(events);
        });
    }
    disconnect() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.provider) {
            this.provider.awareness.setLocalState(null);
            this.provider.disconnect();
            this.provider = null;
        }
        this.doc.destroy();
    }
    // Callback registration
    onConnectionChange(cb) { this.connectionCallbacks.add(cb); }
    onAwarenessChange(cb) { this.awarenessCallbacks.add(cb); }
    onActivityChange(cb) { this.activityCallbacks.add(cb); }
    getAwarenessStates() {
        if (!this.provider)
            return new Map();
        return this.provider.awareness.getStates();
    }
    getActivityFeed() {
        return this.activityFeed.toArray();
    }
    notifyConnection(state) {
        this.connectionCallbacks.forEach((cb) => cb(state));
    }
    notifyAwareness() {
        const states = this.getAwarenessStates();
        this.awarenessCallbacks.forEach((cb) => cb(states));
    }
    notifyActivity(events) {
        this.activityCallbacks.forEach((cb) => cb(events));
    }
}
exports.CampfireConnection = CampfireConnection;
//# sourceMappingURL=connection.js.map