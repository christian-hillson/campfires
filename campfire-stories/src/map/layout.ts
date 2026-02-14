import type { Team, Summary, User, AwarenessState } from '@campfires/shared';

export interface CampfirePosition {
  teamId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  fireSize: number; // 1-3
}

export type SpriteStatus = 'active' | 'idle' | 'draft' | 'offline' | 'visitor';
export type SpriteTask =
  | 'smithing'
  | 'scribing'
  | 'mining'
  | 'chopping'
  | 'carrying'
  | 'sitting'
  | 'tent';

export interface SpriteData {
  userId: string;
  name: string;
  type: 'human' | 'agent';
  color: string;
  status: SpriteStatus;
  task: SpriteTask;
  file: string;
  parentName: string | null;
  teamName: string;
  px: number;
  py: number;
}

const TEAM_COLORS = [
  '#f97316',
  '#60a5fa',
  '#a78bfa',
  '#4ade80',
  '#f472b6',
  '#facc15',
  '#34d399',
  '#fb923c',
];

const TASK_FOR_HUMAN: SpriteTask[] = ['smithing', 'scribing', 'mining'];
const TASK_FOR_AGENT: SpriteTask[] = ['chopping', 'carrying', 'mining'];

export function layoutCampfires(
  teams: Team[],
  summaries: Summary[],
  mapWidth: number,
  mapHeight: number,
): CampfirePosition[] {
  if (teams.length === 0) return [];

  const positions: CampfirePosition[] = [];

  // Arrange in an elliptical layout
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;
  const radiusX = mapWidth * 0.3;
  const radiusY = mapHeight * 0.25;

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const angle = (i / teams.length) * Math.PI * 2 - Math.PI / 2;

    // For single team, center it
    const x = teams.length === 1 ? centerX : centerX + Math.cos(angle) * radiusX;
    const y = teams.length === 1 ? centerY : centerY + Math.sin(angle) * radiusY;

    // Fire size based on event count from latest summary
    const teamSummaries = summaries.filter((s) => s.teamId === team.teamId);
    const latestSummary = teamSummaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const eventCount = latestSummary?.eventCount || 0;

    let fireSize: number;
    if (eventCount >= 10) fireSize = 3;
    else if (eventCount >= 3) fireSize = 2;
    else fireSize = 1;

    positions.push({
      teamId: team.teamId,
      name: team.name,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      x,
      y,
      fireSize,
    });
  }

  return positions;
}

export function layoutSprites(
  campfire: CampfirePosition,
  members: User[],
  awarenessStates: AwarenessState[],
): SpriteData[] {
  const sprites: SpriteData[] = [];
  const radius = campfire.fireSize * 8 + 14;

  // Build awareness lookup
  const awarenessMap = new Map<string, AwarenessState>();
  for (const state of awarenessStates) {
    awarenessMap.set(state.userId, state);
  }

  // Build parent name lookup
  const nameMap = new Map<string, string>();
  for (const m of members) {
    nameMap.set(m.userId, m.displayName);
  }

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const awareness = awarenessMap.get(member.userId);

    // Position around campfire
    const angle = (i / members.length) * Math.PI * 2 - Math.PI / 2;
    const memberRadius = radius + (member.type === 'agent' ? 5 : 0);
    const spriteX = campfire.x + Math.cos(angle) * memberRadius;
    const spriteY = campfire.y + Math.sin(angle) * memberRadius * 0.6;

    // Determine status and task
    let status: SpriteStatus;
    let task: SpriteTask;
    let file = '';

    if (awareness) {
      if (awareness.homeTeamId) {
        status = 'visitor';
        task = 'sitting';
      } else if (awareness.status === 'draft') {
        status = 'draft';
        task = 'tent';
      } else if (awareness.status === 'idle') {
        status = 'idle';
        task = 'sitting';
      } else {
        status = 'active';
        task =
          member.type === 'agent'
            ? TASK_FOR_AGENT[i % TASK_FOR_AGENT.length]
            : TASK_FOR_HUMAN[i % TASK_FOR_HUMAN.length];
      }
      file = awareness.currentFile || '';
    } else {
      // No awareness data — show as offline (not rendered) or use a deterministic
      // "active" state based on member index so the map has life even without Yjs clients
      status = 'active';
      if (member.type === 'agent') {
        task = TASK_FOR_AGENT[i % TASK_FOR_AGENT.length];
      } else {
        task = TASK_FOR_HUMAN[i % TASK_FOR_HUMAN.length];
      }
    }

    sprites.push({
      userId: member.userId,
      name: member.displayName,
      type: member.type,
      color: member.avatarColor,
      status,
      task,
      file,
      parentName: member.parentUserId ? nameMap.get(member.parentUserId) || null : null,
      teamName: campfire.name,
      px: spriteX,
      py: spriteY,
    });
  }

  // Add visitors from awareness who aren't in the members list
  const memberIds = new Set(members.map((m) => m.userId));
  const visitors = awarenessStates.filter((a) => a.homeTeamId && !memberIds.has(a.userId));
  for (let v = 0; v < visitors.length; v++) {
    const visitor = visitors[v];
    const angle =
      ((members.length + v) / (members.length + visitors.length)) * Math.PI * 2 - Math.PI / 2;
    const vRadius = radius + 8;
    const vx = campfire.x + Math.cos(angle) * vRadius;
    const vy = campfire.y + Math.sin(angle) * vRadius * 0.6;

    sprites.push({
      userId: visitor.userId,
      name: visitor.displayName,
      type: visitor.type,
      color: visitor.color,
      status: 'visitor',
      task: 'sitting',
      file: '',
      parentName: null,
      teamName: campfire.name,
      px: vx,
      py: vy,
    });
  }

  return sprites;
}
