#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_js_1 = require("./auth.js");
const api_js_1 = require("./api.js");
const connection_js_1 = require("./connection.js");
const renderer_js_1 = require("./renderer.js");
const types_js_1 = require("./types.js");
// ============================================
// Argument Parsing
// ============================================
function parseArgs() {
    const args = process.argv.slice(2);
    let command = '';
    let serverUrl = types_js_1.CLI_CONFIG.DEFAULT_SERVER_URL;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--server-url' && args[i + 1]) {
            serverUrl = args[i + 1];
            i++;
        }
        else if (!command) {
            command = args[i];
        }
    }
    return { command, serverUrl };
}
// ============================================
// State Assembly
// ============================================
function formatTime(isoTimestamp) {
    const d = new Date(isoTimestamp);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}
function activityDescription(event) {
    switch (event.type) {
        case 'file_save':
            return 'saved ' + (event.file || 'a file');
        case 'file_open':
            return 'opened ' + (event.file || 'a file');
        case 'commit':
            return event.message || 'committed';
        case 'branch_switch':
            return 'switched to ' + (event.branch || 'a branch');
        case 'session_start':
            return 'came online';
        case 'session_end':
            return 'went offline';
        default:
            return event.type;
    }
}
function assembleRenderState(org, teams, team, summaries, members, awarenessStates, activityEvents, connected, reconnecting) {
    // Build member list from awareness, falling back to REST members
    const memberMap = new Map();
    // Seed from REST member list (offline by default)
    for (const m of members) {
        memberMap.set(m.userId, {
            userId: m.userId,
            displayName: m.displayName,
            type: m.type,
            status: 'offline',
            currentFile: null,
            currentFunction: null,
            color: m.avatarColor,
        });
    }
    // Overlay awareness data
    let onlineCount = 0;
    for (const [, state] of awarenessStates) {
        if (!state || !state.userId)
            continue;
        onlineCount++;
        memberMap.set(state.userId, {
            userId: state.userId,
            displayName: state.displayName,
            type: state.type,
            status: state.status,
            currentFile: state.currentFile,
            currentFunction: state.currentFunction,
            color: state.color,
        });
    }
    // Build display name lookup for activity
    const nameMap = new Map();
    for (const [, m] of memberMap) {
        nameMap.set(m.userId, m.displayName);
    }
    // Transform activity events
    const displayEvents = activityEvents.map((e) => ({
        time: formatTime(e.timestamp),
        name: nameMap.get(e.userId) || e.userId.slice(0, 8),
        description: activityDescription(e),
        type: e.type,
    }));
    return {
        tier1: {
            orgName: org?.name || 'Unknown Org',
            teamCount: teams.length,
            onlineCount,
            summaries,
        },
        tier2: {
            teamName: team?.name || 'Unknown Team',
            members: Array.from(memberMap.values()),
        },
        tier3: {
            events: displayEvents,
        },
        connected,
        reconnecting,
    };
}
// ============================================
// Main
// ============================================
async function main() {
    const { command, serverUrl } = parseArgs();
    if (command !== 'watch') {
        console.error('Usage: campfire watch [--server-url <url>]');
        process.exit(1);
    }
    // --- Auth ---
    let token = (0, auth_js_1.loadToken)();
    let payload = token ? (0, auth_js_1.decodeTokenPayload)(token) : null;
    if (!token || !payload) {
        const result = await (0, auth_js_1.interactiveLogin)(serverUrl);
        token = result.token;
        payload = result.payload;
    }
    if (!payload.teamId || !payload.orgId) {
        console.error('You need to join a team first. Use the VS Code extension or web app to join a team.');
        process.exit(1);
    }
    const { teamId, orgId, userId } = payload;
    // --- REST fetch (parallel) ---
    const api = new api_js_1.ApiClient(serverUrl, token);
    const [org, teams, summaries, members] = await Promise.all([
        api.fetchOrg(orgId).catch(() => null),
        api.fetchOrgTeams(orgId).catch(() => []),
        api.fetchOrgSummaries(orgId).catch(() => []),
        api.fetchTeamMembers(teamId).catch(() => []),
    ]);
    const team = teams.find((t) => t.teamId === teamId) || null;
    // Find the current user's display name and color
    const currentUser = members.find((m) => m.userId === userId);
    const displayName = currentUser?.displayName || payload.email;
    const color = currentUser?.avatarColor || '#888888';
    // --- Mutable state ---
    let currentAwareness = new Map();
    let currentActivity = [];
    let currentSummaries = summaries;
    let isConnected = false;
    let isReconnecting = false;
    function triggerRender() {
        const state = assembleRenderState(org, teams, team, currentSummaries, members, currentAwareness, currentActivity, isConnected, isReconnecting);
        (0, renderer_js_1.render)(state);
    }
    // --- Connect ---
    const connection = new connection_js_1.CampfireConnection(serverUrl, teamId, token, userId, displayName, color);
    connection.onConnectionChange((state) => {
        isConnected = state.connected;
        isReconnecting = state.reconnecting;
        triggerRender();
    });
    connection.onAwarenessChange((states) => {
        currentAwareness = states;
        triggerRender();
    });
    connection.onActivityChange((events) => {
        currentActivity = events;
        triggerRender();
    });
    // Enter alternate screen and render initial state
    (0, renderer_js_1.enterAltScreen)();
    const initialState = assembleRenderState(org, teams, team, currentSummaries, members, currentAwareness, currentActivity, isConnected, isReconnecting);
    (0, renderer_js_1.renderImmediate)(initialState);
    connection.connect();
    // --- Summary polling ---
    const summaryInterval = setInterval(async () => {
        try {
            currentSummaries = await api.fetchOrgSummaries(orgId);
            triggerRender();
        }
        catch {
            // Silently retry next cycle
        }
    }, types_js_1.CLI_CONFIG.SUMMARY_POLL_INTERVAL);
    // --- Resize handler ---
    process.stdout.on('resize', () => {
        triggerRender();
    });
    // --- Graceful shutdown ---
    function cleanup() {
        clearInterval(summaryInterval);
        connection.disconnect();
        (0, renderer_js_1.exitAltScreen)();
        process.exit(0);
    }
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}
main().catch((err) => {
    (0, renderer_js_1.exitAltScreen)();
    console.error('Fatal:', err.message || err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map