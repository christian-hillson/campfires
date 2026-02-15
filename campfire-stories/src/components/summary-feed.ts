import type { Summary, Org, Team } from '@campfires/shared';
import { TEAM_COLORS } from '../map/layout.js';

export interface FeedContext {
  org: Org;
  teams: Team[];
  summaries: Summary[];
  onTeamClick: (teamId: string) => void;
}

function esc(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getLatestSummaryForTeam(summaries: Summary[], teamId: string): Summary | null {
  return (
    summaries
      .filter((s) => s.teamId === teamId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
  );
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(' ', maxLen);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, maxLen)) + '...';
}

function getTeamColor(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function createTeamEntry(
  team: Team,
  teamIndex: number,
  summary: Summary | null,
  onTeamClick: (teamId: string) => void,
): HTMLElement {
  const entry = document.createElement('div');
  entry.className = summary ? 'team-entry' : 'team-entry empty';
  entry.dataset.teamId = team.teamId;

  const mainLine = document.createElement('div');
  mainLine.className = 'entry-main';
  mainLine.innerHTML = `<span class="team-dot" style="background:${esc(getTeamColor(teamIndex))}"></span><strong>${esc(team.name)}</strong> — <span class="entry-one-liner">${esc(summary?.oneLiner || 'No activity yet')}</span>`;
  entry.appendChild(mainLine);

  if (summary?.content) {
    const preview = document.createElement('div');
    preview.className = 'entry-preview';
    preview.textContent = truncateAtWord(summary.content, 150);
    entry.appendChild(preview);
  }

  if (summary) {
    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    meta.innerHTML = `<span class="entry-event-count">${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}</span> · ${esc(timeAgo(summary.createdAt))}`;
    entry.appendChild(meta);
  }

  entry.addEventListener('click', () => onTeamClick(team.teamId));

  return entry;
}

export function renderSummaryFeed(container: HTMLElement, ctx: FeedContext): void {
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'stories-header';

  const title = document.createElement('h1');
  title.textContent = '\u2726 FIRESIDE UPDATES';
  header.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'stories-header-org';
  subtitle.textContent = ctx.org.name;
  header.appendChild(subtitle);

  if (ctx.org.mission) {
    const mission = document.createElement('p');
    mission.className = 'mission';
    mission.textContent = ctx.org.mission;
    header.appendChild(mission);
  }

  container.appendChild(header);

  // Team entries
  const list = document.createElement('div');
  list.className = 'team-entries';

  // Sort teams: those with summaries first (by recency), then those without
  const teamsWithSummaries = ctx.teams
    .map((team, i) => ({
      team,
      index: i,
      summary: getLatestSummaryForTeam(ctx.summaries, team.teamId),
    }))
    .sort((a, b) => {
      if (a.summary && !b.summary) return -1;
      if (!a.summary && b.summary) return 1;
      if (a.summary && b.summary) return b.summary.createdAt.localeCompare(a.summary.createdAt);
      return 0;
    });

  for (const { team, index, summary } of teamsWithSummaries) {
    list.appendChild(createTeamEntry(team, index, summary, ctx.onTeamClick));
  }

  if (ctx.teams.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No teams in this organization yet.';
    list.appendChild(empty);
  }

  container.appendChild(list);
}

export function updateSummaryFeed(container: HTMLElement, newSummaries: Summary[]): void {
  for (const summary of newSummaries) {
    const entry = container.querySelector(`.team-entry[data-team-id="${summary.teamId}"]`);
    if (!entry) continue;

    entry.classList.remove('empty');

    const oneLiner = entry.querySelector('.entry-one-liner');
    if (oneLiner) {
      oneLiner.textContent = summary.oneLiner || 'Activity recorded';
    }

    // Update or create content preview
    if (summary.content) {
      let preview = entry.querySelector('.entry-preview');
      if (preview) {
        preview.textContent = truncateAtWord(summary.content, 150);
      } else {
        preview = document.createElement('div');
        preview.className = 'entry-preview';
        preview.textContent = truncateAtWord(summary.content, 150);
        const metaEl = entry.querySelector('.entry-meta');
        entry.insertBefore(preview, metaEl);
      }
    }

    const countEl = entry.querySelector('.entry-event-count');
    if (countEl) {
      countEl.textContent = `${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}`;
    }

    let meta = entry.querySelector('.entry-meta');
    if (meta) {
      meta.innerHTML = `<span class="entry-event-count">${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}</span> · just now`;
    } else {
      meta = document.createElement('div');
      meta.className = 'entry-meta';
      meta.innerHTML = `<span class="entry-event-count">${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}</span> · just now`;
      entry.appendChild(meta);
    }
  }
}
