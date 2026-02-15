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
  | 'tent'
  | 'walking'
  | 'casting'
  | 'strike'
  | 'toss';

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
  homeX: number;
  homeY: number;
  campfireIndex: number;
}

export const TEAM_COLORS = [
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

  // Count teams that need auto-layout (no persisted position)
  const teamsNeedingLayout = teams.filter((t) => t.mapX == null || t.mapY == null);
  const teamsWithPositions = teams.filter((t) => t.mapX != null && t.mapY != null);

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    let x: number;
    let y: number;

    if (team.mapX != null && team.mapY != null) {
      // Use persisted position
      x = team.mapX;
      y = team.mapY;
    } else if (teamsWithPositions.length > 0) {
      // Find a gap position that doesn't overlap existing teams
      const pos = findGapPosition(
        positions.concat(
          teamsWithPositions
            .filter((t) => !positions.find((p) => p.teamId === t.teamId))
            .map((t) => ({
              teamId: t.teamId,
              name: t.name,
              color: TEAM_COLORS[teams.indexOf(t) % TEAM_COLORS.length],
              x: t.mapX ?? 0,
              y: t.mapY ?? 0,
              fireSize: 1,
            })),
        ),
        centerX,
        centerY,
        radiusX,
        radiusY,
        mapWidth,
        mapHeight,
      );
      x = pos.x;
      y = pos.y;
    } else {
      // All teams need layout — use elliptical arrangement
      const layoutIndex = teamsNeedingLayout.indexOf(team);
      const total = teamsNeedingLayout.length;
      const angle = (layoutIndex / total) * Math.PI * 2 - Math.PI / 2;
      x = total === 1 ? centerX : centerX + Math.cos(angle) * radiusX;
      y = total === 1 ? centerY : centerY + Math.sin(angle) * radiusY;
    }

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

/** Find a gap position for a new team that doesn't overlap existing campfires */
export function findGapPosition(
  existing: CampfirePosition[],
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } {
  const minDistance = 60; // minimum pixel-art units between campfires

  // Try angles around the ellipse, find one with maximum distance from existing
  let bestX = centerX;
  let bestY = centerY;
  let bestMinDist = 0;

  for (let attempt = 0; attempt < 36; attempt++) {
    const angle = (attempt / 36) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;

    // Clamp to map bounds
    const cx = Math.max(40, Math.min(mapWidth - 40, x));
    const cy = Math.max(40, Math.min(mapHeight - 40, y));

    let closestDist = Infinity;
    for (const pos of existing) {
      const dist = Math.hypot(cx - pos.x, cy - pos.y);
      closestDist = Math.min(closestDist, dist);
    }

    if (closestDist > bestMinDist) {
      bestMinDist = closestDist;
      bestX = cx;
      bestY = cy;
    }
  }

  // If best distance is too small, try pushing outward
  if (bestMinDist < minDistance && existing.length > 0) {
    const expandedRX = radiusX * 1.3;
    const expandedRY = radiusY * 1.3;
    for (let attempt = 0; attempt < 36; attempt++) {
      const angle = (attempt / 36) * Math.PI * 2 - Math.PI / 2;
      const x = Math.max(40, Math.min(mapWidth - 40, centerX + Math.cos(angle) * expandedRX));
      const y = Math.max(40, Math.min(mapHeight - 40, centerY + Math.sin(angle) * expandedRY));

      let closestDist = Infinity;
      for (const pos of existing) {
        closestDist = Math.min(closestDist, Math.hypot(x - pos.x, y - pos.y));
      }

      if (closestDist > bestMinDist) {
        bestMinDist = closestDist;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { x: bestX, y: bestY };
}

export function layoutSprites(
  campfire: CampfirePosition,
  members: User[],
  awarenessStates: AwarenessState[],
  campfireIndex: number = 0,
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
      homeX: spriteX,
      homeY: spriteY,
      campfireIndex,
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
      homeX: vx,
      homeY: vy,
      campfireIndex,
    });
  }

  return sprites;
}
