import type { RenderState, MemberState, ActivityDisplayEvent } from './types.js';
import { CLI_CONFIG } from './types.js';

// ANSI escape codes
const ESC = '\x1b';
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const AMBER = `${ESC}[38;5;214m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const GRAY = `${ESC}[90m`;
const CYAN = `${ESC}[36m`;
const WHITE = `${ESC}[37m`;
const RED = `${ESC}[31m`;

// Alternate screen buffer
const ALT_SCREEN_ON = `${ESC}[?1049h`;
const ALT_SCREEN_OFF = `${ESC}[?1049l`;
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;
const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;

// Status emoji map
const STATUS_EMOJI: Record<string, string> = {
  active: '🟢',
  idle: '🟡',
  draft: '⚫',
  offline: '⚪',
  visitor: '👁️',
};

// Activity type emoji map
const ACTIVITY_EMOJI: Record<string, string> = {
  file_open: '📂',
  file_save: '💾',
  commit: '📦',
  branch_switch: '🔀',
  session_start: '▶️',
  session_end: '⏹️',
};

let renderTimeout: ReturnType<typeof setTimeout> | null = null;
let isAltScreen = false;

export function enterAltScreen(): void {
  if (isAltScreen) return;
  process.stdout.write(ALT_SCREEN_ON + CURSOR_HIDE);
  isAltScreen = true;
}

export function exitAltScreen(): void {
  if (!isAltScreen) return;
  process.stdout.write(CURSOR_SHOW + ALT_SCREEN_OFF);
  isAltScreen = false;
}

function getWidth(): number {
  return Math.max(process.stdout.columns || 80, CLI_CONFIG.MIN_WIDTH);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

function truncateFilePath(filePath: string, maxLen: number): string {
  if (filePath.length <= maxLen) return filePath;

  const parts = filePath.split('/');
  if (parts.length <= 2) return truncate(filePath, maxLen);

  // Keep filename and abbreviate directories
  const filename = parts[parts.length - 1];
  if (filename.length >= maxLen - 4) return truncate(filename, maxLen);

  let result = '…/' + filename;
  // Add parent dirs from the end until we run out of space
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i] + '/' + result;
    if (candidate.length > maxLen) break;
    result = candidate;
  }
  if (result.length < filePath.length) {
    result = '…/' + result.replace(/^…\//, '');
  }
  return truncate(result, maxLen);
}

function divider(width: number): string {
  return DIM + '─'.repeat(width) + RESET;
}

// ============================================
// Tier 1: Org Overview
// ============================================

function renderTier1(state: RenderState, width: number): string[] {
  const lines: string[] = [];
  const { tier1 } = state;

  lines.push(BOLD + '🔥 ' + tier1.orgName + ' Bonfire' + RESET);
  lines.push(
    DIM +
      tier1.teamCount + ' campfire' + (tier1.teamCount !== 1 ? 's' : '') +
      ' · ' +
      tier1.onlineCount + ' online' +
      RESET
  );
  lines.push(divider(width));

  if (tier1.summaries.length === 0) {
    lines.push(DIM + 'No summaries yet' + RESET);
  } else {
    for (const summary of tier1.summaries.slice(0, 3)) {
      lines.push(truncate(summary.content, width));
    }
  }

  return lines;
}

// ============================================
// Tier 2: Team Presence
// ============================================

function sortMembers(members: MemberState[]): MemberState[] {
  const order: Record<string, number> = { active: 0, idle: 1, draft: 2, visitor: 3, offline: 4 };
  return [...members].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
}

function renderMember(member: MemberState, width: number, isNested: boolean): string {
  const prefix = isNested ? '  ↳ ' : '  ';
  const emoji = STATUS_EMOJI[member.status] || '⚪';
  const name = member.displayName;

  let detail = '';
  if (member.currentFile) {
    const funcSuffix = member.currentFunction ? `→${member.currentFunction}` : '';
    const full = member.currentFile + funcSuffix;
    const maxDetail = width - prefix.length - 3 - name.length - 3; // emoji + space + name + space
    detail = ' ' + DIM + truncateFilePath(full, Math.max(10, maxDetail)) + RESET;
  }

  return prefix + emoji + ' ' + name + detail;
}

function renderTier2(state: RenderState, width: number): string[] {
  const lines: string[] = [];
  const { tier2 } = state;

  lines.push('');
  if (tier2.visitingTeamName) {
    lines.push(BOLD + CYAN + '👁️  Visiting: ' + tier2.visitingTeamName + ' Campfire' + RESET);
  } else {
    lines.push(BOLD + '🏕️  ' + tier2.teamName + ' Campfire' + RESET);
  }
  lines.push(divider(width));

  const sorted = sortMembers(tier2.members);

  // Separate top-level members from agents with parents
  const topLevel = sorted.filter((m) => !m.parentUserId);
  const agents = sorted.filter((m) => m.parentUserId);

  for (const member of topLevel) {
    lines.push(renderMember(member, width, false));

    // Render any nested agents for this member
    const childAgents = agents.filter((a) => a.parentUserId === member.userId);
    for (const agent of childAgents) {
      lines.push(renderMember(agent, width, true));
    }
  }

  // Render orphaned agents (parentUserId set but parent not in awareness)
  const nestedIds = new Set(agents.filter((a) => topLevel.some((t) => t.userId === a.parentUserId)).map((a) => a.userId));
  const orphanedAgents = agents.filter((a) => !nestedIds.has(a.userId));
  for (const agent of orphanedAgents) {
    lines.push(renderMember(agent, width, false));
  }

  return lines;
}

// ============================================
// Tier 3: Activity Feed
// ============================================

function renderTier3(state: RenderState, width: number): string[] {
  const lines: string[] = [];
  const { tier3 } = state;

  lines.push('');
  lines.push(BOLD + 'ACTIVITY' + RESET);
  lines.push(divider(width));

  if (tier3.events.length === 0) {
    lines.push(DIM + 'No activity yet' + RESET);
    return lines;
  }

  const displayEvents = tier3.events.slice(-CLI_CONFIG.ACTIVITY_DISPLAY_MAX);
  for (const event of displayEvents) {
    const emoji = ACTIVITY_EMOJI[event.type] || '•';
    const timeStr = GRAY + event.time + RESET;
    const nameStr = event.name;
    const descMaxLen = width - event.time.length - event.name.length - 6; // time + space + name + space + emoji + space
    const desc = truncate(event.description, Math.max(10, descMaxLen));

    // Highlight commits in amber
    const descColor = event.type === 'commit' ? AMBER : '';
    const descReset = event.type === 'commit' ? RESET : '';

    lines.push(`  ${timeStr} ${emoji} ${nameStr} ${descColor}${desc}${descReset}`);
  }

  return lines;
}

// ============================================
// Status Bar
// ============================================

function renderStatusBar(state: RenderState, width: number): string {
  if (!state.connected && state.reconnecting) {
    return YELLOW + 'Reconnecting...' + RESET;
  }
  if (!state.connected) {
    return RED + 'Disconnected' + RESET;
  }
  return '';
}

// ============================================
// Main Render
// ============================================

function renderFrame(state: RenderState): void {
  const width = getWidth();
  const lines: string[] = [];

  // Status bar (at top if disconnected)
  const status = renderStatusBar(state, width);
  if (status) {
    lines.push(status);
    lines.push('');
  }

  lines.push(...renderTier1(state, width));
  lines.push(...renderTier2(state, width));
  lines.push(...renderTier3(state, width));

  // Footer
  lines.push('');
  lines.push(DIM + 'Ctrl+C to exit' + RESET);

  process.stdout.write(CLEAR_SCREEN + lines.join('\n') + '\n');
}

/**
 * Debounced render — coalesces rapid updates into a single frame.
 */
export function render(state: RenderState): void {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }

  renderTimeout = setTimeout(() => {
    renderTimeout = null;
    renderFrame(state);
  }, CLI_CONFIG.RENDER_DEBOUNCE);
}

/**
 * Immediate render — bypasses debouncing (for initial draw and cleanup).
 */
export function renderImmediate(state: RenderState): void {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }
  renderFrame(state);
}
