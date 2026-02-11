import type { Summary, Org, Team } from '@campfires/shared';

export interface FeedContext {
  org: Org;
  teams: Team[];
  summaries: Summary[];
  onTeamClick: (teamId: string) => void;
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

function createTeamCard(
  team: Team,
  summary: Summary | null,
  onTeamClick: (teamId: string) => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = summary ? 'team-card' : 'team-card empty';
  card.dataset.teamId = team.teamId;

  const header = document.createElement('div');
  header.className = 'team-card-header';

  const name = document.createElement('h2');
  name.textContent = team.name;
  header.appendChild(name);

  if (summary) {
    const count = document.createElement('span');
    count.className = 'event-count';
    count.textContent = `${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}`;
    header.appendChild(count);
  }

  card.appendChild(header);

  const oneLiner = document.createElement('div');
  oneLiner.className = 'one-liner';
  oneLiner.textContent = summary?.oneLiner || 'No activity yet';
  card.appendChild(oneLiner);

  if (summary) {
    const updated = document.createElement('div');
    updated.className = 'updated-at';
    updated.textContent = `Updated ${timeAgo(summary.createdAt)}`;
    card.appendChild(updated);
  }

  card.addEventListener('click', () => onTeamClick(team.teamId));

  return card;
}

export function renderSummaryFeed(container: HTMLElement, ctx: FeedContext): void {
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'reel-header';

  const title = document.createElement('h1');
  title.textContent = `\uD83D\uDD25 ${ctx.org.name} Bonfire`;
  header.appendChild(title);

  if (ctx.org.mission) {
    const mission = document.createElement('p');
    mission.className = 'mission';
    mission.textContent = ctx.org.mission;
    header.appendChild(mission);
  }

  container.appendChild(header);

  // Team cards
  const grid = document.createElement('div');
  grid.className = 'team-cards';

  // Sort teams: those with summaries first (by recency), then those without
  const teamsWithSummaries = ctx.teams
    .map((team) => ({ team, summary: getLatestSummaryForTeam(ctx.summaries, team.teamId) }))
    .sort((a, b) => {
      if (a.summary && !b.summary) return -1;
      if (!a.summary && b.summary) return 1;
      if (a.summary && b.summary) return b.summary.createdAt.localeCompare(a.summary.createdAt);
      return 0;
    });

  for (const { team, summary } of teamsWithSummaries) {
    grid.appendChild(createTeamCard(team, summary, ctx.onTeamClick));
  }

  if (ctx.teams.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No teams in this organization yet.';
    grid.appendChild(empty);
  }

  container.appendChild(grid);
}

export function updateSummaryFeed(container: HTMLElement, newSummaries: Summary[]): void {
  for (const summary of newSummaries) {
    const card = container.querySelector(`.team-card[data-team-id="${summary.teamId}"]`);
    if (!card) continue;

    card.classList.remove('empty');

    const oneLiner = card.querySelector('.one-liner');
    if (oneLiner) {
      oneLiner.textContent = summary.oneLiner || 'Activity recorded';
    }

    const count = card.querySelector('.event-count');
    if (count) {
      count.textContent = `${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}`;
    } else {
      const header = card.querySelector('.team-card-header');
      if (header) {
        const countEl = document.createElement('span');
        countEl.className = 'event-count';
        countEl.textContent = `${summary.eventCount} event${summary.eventCount !== 1 ? 's' : ''}`;
        header.appendChild(countEl);
      }
    }

    let updated = card.querySelector('.updated-at');
    if (updated) {
      updated.textContent = `Updated just now`;
    } else {
      updated = document.createElement('div');
      updated.className = 'updated-at';
      updated.textContent = `Updated just now`;
      card.appendChild(updated);
    }
  }
}
