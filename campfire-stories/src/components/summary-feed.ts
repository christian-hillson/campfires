import type { Summary, Org, Team, Spark } from '@campfires/shared';
import { CONFIG } from '@campfires/shared';
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
  title.textContent = '\u2726 CAMPFIRE STORIES';
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

  // Spark history link
  const sparkLogLink = document.createElement('div');
  sparkLogLink.className = 'spark-log-link';
  sparkLogLink.innerHTML = '<button class="spark-log-btn">\u26A1 Spark History</button>';
  const sparkLogBtn = sparkLogLink.querySelector('button');
  if (sparkLogBtn) {
    sparkLogBtn.addEventListener('click', () => {
      renderSparkLog(container, ctx);
    });
  }
  container.appendChild(sparkLogLink);
}

function renderSparkLog(container: HTMLElement, ctx: FeedContext): void {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'spark-log-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'back-button';
  backBtn.textContent = '\u2190 Back to feed';
  backBtn.addEventListener('click', () => renderSummaryFeed(container, ctx));
  header.appendChild(backBtn);

  const title = document.createElement('h1');
  title.className = 'spark-log-title';
  title.textContent = '\u26A1 SPARK HISTORY';
  header.appendChild(title);

  container.appendChild(header);

  const logContainer = document.createElement('div');
  logContainer.className = 'spark-log';
  logContainer.innerHTML = '<div class="loading">Loading...</div>';
  container.appendChild(logContainer);

  const teamMap = new Map(ctx.teams.map((t, i) => [t.teamId, { name: t.name, index: i }]));

  fetch(`/api/orgs/${ctx.org.orgId}/sparks/log?limit=50`)
    .then((r) => (r.ok ? r.json() : { sparks: [], hasMore: false }))
    .then(({ sparks, hasMore }: { sparks: Spark[]; hasMore: boolean }) => {
      logContainer.innerHTML = '';

      if (sparks.length === 0) {
        logContainer.innerHTML = '<div class="empty-state">No sparks detected yet.</div>';
        return;
      }

      for (const spark of sparks) {
        const entry = document.createElement('div');
        entry.className = 'spark-log-entry';
        entry.dataset.status = spark.status;

        const teamNames = spark.teamConnections
          .map((tc) => {
            const info = teamMap.get(tc.teamId);
            const color = info ? getTeamColor(info.index) : '#fbbf24';
            return `<span class="team-dot" style="background:${esc(color)}"></span>${esc(info?.name || tc.teamName)}`;
          })
          .join(' \u2194 ');

        const statusBadge =
          spark.status === 'active'
            ? '<span class="spark-badge active">active</span>'
            : spark.status === 'dismissed'
              ? '<span class="spark-badge dismissed">dismissed</span>'
              : '<span class="spark-badge expired">expired</span>';

        entry.innerHTML = `
          <div class="spark-log-header-row">
            <span class="spark-log-time">${esc(timeAgo(spark.createdAt))}</span>
            <span class="spark-log-teams">${teamNames}</span>
            ${statusBadge}
          </div>
          <div class="spark-log-summary">${esc(spark.summary)}</div>
        `;

        // Expand/collapse details on click
        entry.addEventListener('click', () => {
          const existing = entry.querySelector('.spark-log-details');
          if (existing) {
            existing.remove();
            return;
          }
          const details = document.createElement('div');
          details.className = 'spark-log-details';
          details.innerHTML = `
            <div class="spark-log-detail-text">${esc(spark.details)}</div>
            ${spark.suggestedAction ? `<div class="spark-log-action">\u2192 ${esc(spark.suggestedAction)}</div>` : ''}
          `;
          entry.appendChild(details);
        });

        logContainer.appendChild(entry);
      }

      if (hasMore) {
        const more = document.createElement('div');
        more.className = 'spark-log-more';
        more.textContent = 'More sparks available...';
        logContainer.appendChild(more);
      }
    })
    .catch(() => {
      logContainer.innerHTML = '<div class="error">Failed to load spark history</div>';
    });
}

export function addSparkToFeed(
  container: HTMLElement,
  spark: Spark,
  teams: Team[],
): void {
  const list = container.querySelector('.team-entries');
  if (!list) return;

  const teamMap = new Map(teams.map((t, i) => [t.teamId, { name: t.name, index: i }]));
  const teamNames = spark.teamConnections
    .map((tc) => {
      const info = teamMap.get(tc.teamId);
      const color = info ? getTeamColor(info.index) : '#fbbf24';
      return `<span class="team-dot" style="background:${esc(color)}"></span>${esc(info?.name || tc.teamName)}`;
    })
    .join(' \u2194 ');

  const entry = document.createElement('div');
  entry.className = 'spark-entry spark-entry-new';
  entry.innerHTML = `
    <div class="spark-entry-icon">\u26A1</div>
    <div class="spark-entry-body">
      <div class="spark-entry-teams">${teamNames}</div>
      <div class="spark-entry-summary">${esc(spark.summary)}</div>
    </div>
  `;

  list.insertBefore(entry, list.firstChild);

  // After SPARK_FADE_DURATION, remove the "new" glow
  setTimeout(() => {
    entry.classList.remove('spark-entry-new');
  }, CONFIG.SPARK_FADE_DURATION);

  // After 60s, remove entirely
  setTimeout(() => {
    entry.remove();
  }, 60_000);
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
