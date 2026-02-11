#!/usr/bin/env node

import { resolve } from 'node:path';
import type { AwarenessState, ActivityEvent, Org, Team, Summary, User } from '@campfires/shared';
import { loadToken, decodeTokenPayload, interactiveLogin } from './auth.js';
import { ApiClient } from './api.js';
import { CampfireConnection, type VisitorConfig } from './connection.js';
import { GitWatcher, FileWatcher } from './watchers.js';
import { enterAltScreen, exitAltScreen, render, renderImmediate } from './renderer.js';
import { CLI_CONFIG } from './types.js';
import type { RenderState, MemberState, ActivityDisplayEvent, TokenPayload } from './types.js';
import { detectAgent } from './agent-detect.js';
import { installGitHooks, uninstallGitHooks } from './git-hooks.js';

// ============================================
// Argument Parsing
// ============================================

function parseArgs(): { command: string; serverUrl: string; dir: string; agentMode: 'auto' | 'force' | 'off'; visitTeamId: string | null } {
  const args = process.argv.slice(2);
  let command = '';
  let serverUrl: string = CLI_CONFIG.DEFAULT_SERVER_URL;
  let dir: string = process.cwd();
  let agentMode: 'auto' | 'force' | 'off' = 'auto';
  let visitTeamId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--server-url' && args[i + 1]) {
      serverUrl = args[i + 1];
      i++;
    } else if (args[i] === '--dir' && args[i + 1]) {
      dir = resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--agent') {
      agentMode = 'force';
    } else if (args[i] === '--no-agent') {
      agentMode = 'off';
    } else if (args[i] === '--visit' && args[i + 1]) {
      visitTeamId = args[i + 1];
      i++;
    } else if (!command) {
      command = args[i];
    }
  }

  return { command, serverUrl, dir, agentMode, visitTeamId };
}

// ============================================
// State Assembly
// ============================================

function formatTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function activityDescription(event: ActivityEvent): string {
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

function assembleRenderState(
  org: Org | null,
  teams: Team[],
  team: Team | null,
  summaries: Summary[],
  members: User[],
  awarenessStates: Map<number, AwarenessState>,
  activityEvents: ActivityEvent[],
  connected: boolean,
  reconnecting: boolean,
  visitingTeamName?: string,
): RenderState {
  // Build member list from awareness, falling back to REST members
  const memberMap = new Map<string, MemberState>();

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
    if (!state || !state.userId) continue;
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
  const nameMap = new Map<string, string>();
  for (const [, m] of memberMap) {
    nameMap.set(m.userId, m.displayName);
  }

  // Transform activity events
  const displayEvents: ActivityDisplayEvent[] = activityEvents.map((e) => ({
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
      ...(visitingTeamName ? { visitingTeamName } : {}),
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

async function main(): Promise<void> {
  const { command, serverUrl, dir, agentMode, visitTeamId } = parseArgs();

  if (command !== 'watch') {
    console.error('Usage: campfire watch [--server-url <url>] [--dir <path>] [--agent | --no-agent] [--visit <teamId>]');
    process.exit(1);
  }

  // --- Auth ---
  let token = loadToken();
  let payload: TokenPayload | null = token ? decodeTokenPayload(token) : null;

  if (!token || !payload) {
    const result = await interactiveLogin(serverUrl);
    token = result.token;
    payload = result.payload;
  }

  if (!payload.teamId || !payload.orgId) {
    console.error('You need to join a team first. Use the VS Code extension or web app to join a team.');
    process.exit(1);
  }

  const { teamId, orgId, userId } = payload;

  // --- REST fetch (parallel) ---
  const api = new ApiClient(serverUrl, token);

  const [org, teams, summaries, members] = await Promise.all([
    api.fetchOrg(orgId).catch(() => null),
    api.fetchOrgTeams(orgId).catch(() => [] as Team[]),
    api.fetchOrgSummaries(orgId).catch(() => [] as Summary[]),
    api.fetchTeamMembers(teamId).catch(() => [] as User[]),
  ]);

  const team = teams.find((t) => t.teamId === teamId) || null;

  // --- Visit mode validation ---
  let visitTargetTeamId = teamId;
  let visitTargetTeam = team;
  let isVisitMode = false;

  if (visitTeamId) {
    const targetTeam = teams.find((t) => t.teamId === visitTeamId);
    if (!targetTeam) {
      console.error(`Team "${visitTeamId}" not found in your organization.`);
      console.error('Available teams:');
      for (const t of teams) {
        if (t.teamId !== teamId) {
          console.error(`  ${t.teamId} — ${t.name}`);
        }
      }
      process.exit(1);
    }
    visitTargetTeamId = visitTeamId;
    visitTargetTeam = targetTeam;
    isVisitMode = true;
  }

  // Find the current user's display name and color
  const currentUser = members.find((m) => m.userId === userId);
  const displayName = currentUser?.displayName || payload.email;
  const color = currentUser?.avatarColor || '#888888';

  // --- Agent detection & registration ---
  let agentActive = false;
  let agentUserId: string | null = null;
  let agentToken: string | null = null;
  let agentDisplayName: string | null = null;
  let agentColor: string | null = null;

  const shouldDetect = !isVisitMode && (agentMode === 'force' || (agentMode === 'auto' && detectAgent(dir).detected));

  if (shouldDetect) {
    try {
      const detection = detectAgent(dir);
      const name = detection.agentName ? `${displayName}'s ${detection.agentName}` : undefined;
      const result = await api.registerAgent(name);
      agentUserId = result.agent.userId;
      agentToken = result.token;
      agentDisplayName = result.agent.displayName;
      agentColor = result.agent.avatarColor;
      agentActive = true;

      // Install persistent git hooks
      installGitHooks({ workDir: dir, serverUrl, agentToken });
    } catch (err) {
      // Agent setup failure is non-fatal
      console.error('Agent setup failed (continuing as human-only):', (err as Error).message);
    }
  }

  // --- Mutable state ---
  let currentAwareness = new Map<number, AwarenessState>();
  let currentActivity: ActivityEvent[] = [];
  let currentSummaries = summaries;
  let isConnected = false;
  let isReconnecting = false;

  function triggerRender(): void {
    const state = assembleRenderState(
      org,
      teams,
      visitTargetTeam,
      currentSummaries,
      isVisitMode ? [] : members,
      currentAwareness,
      currentActivity,
      isConnected,
      isReconnecting,
      isVisitMode ? visitTargetTeam?.name : undefined,
    );
    render(state);
  }

  // --- Connect ---
  const visitorCfg: VisitorConfig | undefined = isVisitMode ? { homeTeamId: teamId } : undefined;
  const connection = new CampfireConnection(serverUrl, visitTargetTeamId, token, userId, displayName, color, visitorCfg);

  // Configure agent identity on the connection
  if (agentActive && agentUserId && agentDisplayName && agentColor) {
    connection.setAgentConfig({
      agentUserId,
      agentDisplayName,
      agentColor,
      parentUserId: userId,
    });
  }

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
  enterAltScreen();

  const initialState = assembleRenderState(
    org, teams, visitTargetTeam, currentSummaries, isVisitMode ? [] : members,
    currentAwareness, currentActivity, isConnected, isReconnecting,
    isVisitMode ? visitTargetTeam?.name : undefined,
  );
  renderImmediate(initialState);

  connection.connect();

  // --- Watchers (skip in visit mode) ---
  let gitWatcher: GitWatcher | null = null;
  let fileWatcher: FileWatcher | null = null;

  if (!isVisitMode) {
    const pushCommit = agentActive
      ? (hash: string, message: string) => connection.pushAgentActivityEvent('commit', { message, metadata: { hash } })
      : (hash: string, message: string) => connection.pushActivityEvent('commit', { message, metadata: { hash } });

    const pushBranchSwitch = agentActive
      ? (branch: string) => {
          connection.setCurrentBranch(branch);
          connection.pushAgentActivityEvent('branch_switch', { branch });
        }
      : (branch: string) => {
          connection.setCurrentBranch(branch);
          connection.pushActivityEvent('branch_switch', { branch });
        };

    const pushFileSave = agentActive
      ? (relativePath: string) => connection.pushAgentActivityEvent('file_save', { file: relativePath })
      : (relativePath: string) => connection.pushActivityEvent('file_save', { file: relativePath });

    gitWatcher = new GitWatcher(dir, {
      onCommit: pushCommit,
      onBranchSwitch: pushBranchSwitch,
    });

    fileWatcher = new FileWatcher(dir, {
      onFileSave: pushFileSave,
    });

    // Emit session_start once connected, then start watchers
    let watchersStarted = false;
    connection.onConnectionChange(async (state) => {
      if (state.connected && !watchersStarted) {
        watchersStarted = true;
        connection.pushActivityEvent('session_start');
        if (agentActive) {
          connection.pushAgentActivityEvent('session_start');
        }
        await gitWatcher!.start();
        // Set initial branch in awareness
        const branch = gitWatcher!.getCurrentBranch();
        if (branch) connection.setCurrentBranch(branch);
        fileWatcher!.start();
      }
    });
  }

  // --- Summary polling ---
  const summaryInterval = setInterval(async () => {
    try {
      currentSummaries = await api.fetchOrgSummaries(orgId);
      triggerRender();
    } catch {
      // Silently retry next cycle
    }
  }, CLI_CONFIG.SUMMARY_POLL_INTERVAL);

  // --- Resize handler ---
  process.stdout.on('resize', () => {
    triggerRender();
  });

  // --- Graceful shutdown ---
  function cleanup(): void {
    if (agentActive) {
      connection.pushAgentActivityEvent('session_end');
    }
    gitWatcher?.dispose();
    fileWatcher?.dispose();
    clearInterval(summaryInterval);
    connection.disconnect();
    exitAltScreen();
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  exitAltScreen();
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
