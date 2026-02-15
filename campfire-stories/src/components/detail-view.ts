import type { User, ActivityEvent, Summary, Team, AwarenessState, Spark } from '@campfires/shared';

export interface DetailContext {
  team: Team;
  orgId: string;
  serverUrl: string;
  onBack: () => void;
  awareness?: AwarenessState[];
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

function renderMembers(members: User[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Members';
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'member-list';

  for (const member of members) {
    const chip = document.createElement('div');
    chip.className = 'member-chip';

    const dot = document.createElement('span');
    dot.className = 'member-dot';
    dot.style.backgroundColor = member.avatarColor;
    chip.appendChild(dot);

    const name = document.createElement('span');
    name.textContent = member.displayName;
    chip.appendChild(name);

    if (member.type === 'agent') {
      const badge = document.createElement('span');
      badge.className = 'member-type';
      badge.textContent = 'agent';
      chip.appendChild(badge);
    }

    list.appendChild(chip);
  }

  if (members.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No members yet.';
    list.appendChild(empty);
  }

  section.appendChild(list);
  return section;
}

function renderSummaryContent(summaries: Summary[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Latest Summary';
  section.appendChild(heading);

  if (summaries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No summaries yet.';
    section.appendChild(empty);
    return section;
  }

  const latest = summaries[0];

  if (latest.oneLiner) {
    const headline = document.createElement('div');
    headline.className = 'summary-one-liner';
    headline.textContent = latest.oneLiner;
    section.appendChild(headline);
  }

  const content = document.createElement('div');
  content.className = 'summary-content';
  content.textContent = latest.content;
  section.appendChild(content);

  const meta = document.createElement('div');
  meta.className = 'summary-meta';
  const period = `${timeAgo(latest.periodStart)} — ${timeAgo(latest.periodEnd)}`;
  meta.textContent = `${period} · ${latest.eventCount} event${latest.eventCount !== 1 ? 's' : ''}`;
  section.appendChild(meta);

  return section;
}

function renderPresence(awarenessStates: AwarenessState[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.textContent = "Who's Here";
  section.appendChild(heading);

  const online = awarenessStates.filter((a) => a.status !== 'offline');
  if (online.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No one online right now.';
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement('div');
  list.className = 'member-list';

  const statusColors: Record<string, string> = {
    active: '#3fb950',
    idle: '#d29922',
    draft: '#6e7681',
    visitor: '#58a6ff',
  };

  for (const state of online) {
    const chip = document.createElement('div');
    chip.className = 'member-chip';

    const dot = document.createElement('span');
    dot.className = 'member-dot';
    dot.style.backgroundColor = state.color;
    chip.appendChild(dot);

    const name = document.createElement('span');
    name.textContent = state.displayName;
    chip.appendChild(name);

    const badge = document.createElement('span');
    badge.className = 'member-type';
    badge.style.color = statusColors[state.status] || '#6e7681';
    badge.textContent = state.homeTeamId ? 'visitor' : state.status;
    chip.appendChild(badge);

    list.appendChild(chip);
  }

  section.appendChild(list);
  return section;
}

function narratize(
  event: ActivityEvent,
  nameMap: Map<string, { displayName: string; type: string }>,
): string {
  const user = nameMap.get(event.userId);
  const rawName = user?.displayName || 'Someone';
  const name = event.userType === 'agent' ? `${rawName} (golem)` : rawName;

  switch (event.type) {
    case 'session_start': {
      let text = `${name} started a new session`;
      if (event.file) text += ` on <code>${event.file}</code>`;
      if (event.branch) text += ` [${event.branch}]`;
      return text;
    }
    case 'session_end':
      return `${name}'s session ended`;
    case 'commit': {
      let text = `${name} committed`;
      if (event.message) text += `: ${event.message}`;
      if (event.branch) text += ` [${event.branch}]`;
      return text;
    }
    case 'branch_switch':
      return `${name} switched to <code>${event.branch || 'unknown'}</code>`;
    case 'file_save':
      return `${name} saved <code>${event.file || 'a file'}</code>`;
    case 'file_open':
      return `${name} opened <code>${event.file || 'a file'}</code>`;
    default:
      return `${name} did something`;
  }
}

function renderLogs(events: ActivityEvent[], members: User[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.className = 'logs-panel-title';
  heading.textContent = '\u2726 LOGS';
  section.appendChild(heading);

  if (events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No logs yet.';
    section.appendChild(empty);
    return section;
  }

  const nameMap = new Map<string, { displayName: string; type: string }>();
  for (const m of members) {
    nameMap.set(m.userId, { displayName: m.displayName, type: m.type });
  }

  const list = document.createElement('div');
  list.className = 'logs-list';

  for (const event of events) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = timeAgo(event.timestamp);
    entry.appendChild(time);

    const text = document.createElement('span');
    text.className = 'log-text';
    text.innerHTML = narratize(event, nameMap);
    entry.appendChild(text);

    list.appendChild(entry);
  }

  section.appendChild(list);
  return section;
}

function esc2(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderSparks(
  sparks: Spark[],
  teamId: string,
  teams: Team[],
  serverUrl: string,
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section panel-sparks';

  if (sparks.length === 0) return section;

  const heading = document.createElement('h3');
  heading.textContent = '\u26A1 Connections';
  section.appendChild(heading);

  const teamMap = new Map(teams.map((t) => [t.teamId, t.name]));

  for (const spark of sparks) {
    const entry = document.createElement('div');
    entry.className = 'panel-spark-entry';

    const myConnection = spark.teamConnections.find((tc) => tc.teamId === teamId);
    const otherConnections = spark.teamConnections.filter((tc) => tc.teamId !== teamId);
    const otherNames = otherConnections
      .map((tc) => teamMap.get(tc.teamId) || tc.teamName)
      .join(', ');

    const header = document.createElement('div');
    header.className = 'spark-entry-header';
    header.innerHTML = `<span class="spark-icon">\u26A1</span> <strong>${esc2(otherNames)}</strong>`;
    entry.appendChild(header);

    const perspective = document.createElement('div');
    perspective.className = 'spark-entry-perspective';
    perspective.textContent = myConnection?.perspective || spark.summary;
    entry.appendChild(perspective);

    if (spark.suggestedAction && myConnection?.actionRequired) {
      const action = document.createElement('div');
      action.className = 'spark-entry-action';
      action.textContent = `\u2192 ${spark.suggestedAction}`;
      entry.appendChild(action);
    }

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'spark-dismiss-btn';
    dismissBtn.textContent = '\u2715';
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fetch(`${serverUrl}/api/sparks/${spark.id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      }).then(() => entry.remove());
    });
    entry.appendChild(dismissBtn);

    // Mark as viewed
    fetch(`${serverUrl}/api/sparks/${spark.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    }).catch(() => {});

    section.appendChild(entry);
  }

  return section;
}

export async function renderDetailView(container: HTMLElement, ctx: DetailContext): Promise<void> {
  container.innerHTML = '';

  const view = document.createElement('div');
  view.className = 'detail-view';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'back-button';
  backBtn.textContent = '\u2190 Back to feed';
  backBtn.addEventListener('click', ctx.onBack);
  view.appendChild(backBtn);

  // Header
  const header = document.createElement('div');
  header.className = 'detail-header';

  const title = document.createElement('h1');
  title.textContent = ctx.team.name;
  header.appendChild(title);

  if (ctx.team.description) {
    const desc = document.createElement('p');
    desc.className = 'description';
    desc.textContent = ctx.team.description;
    header.appendChild(desc);
  }

  view.appendChild(header);

  // Loading state
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'Loading...';
  view.appendChild(loading);
  container.appendChild(view);

  try {
    const [membersRes, activityRes, summariesRes, sparksRes] = await Promise.all([
      fetch(`${ctx.serverUrl}/api/teams/${ctx.team.teamId}/members`),
      fetch(`${ctx.serverUrl}/api/teams/${ctx.team.teamId}/activity?limit=20`),
      fetch(`${ctx.serverUrl}/api/orgs/${ctx.orgId}/summaries`),
      fetch(`${ctx.serverUrl}/api/orgs/${ctx.orgId}/sparks?teamId=${ctx.team.teamId}&status=active`),
    ]);

    const members: User[] = membersRes.ok ? await membersRes.json() : [];
    const activity: ActivityEvent[] = activityRes.ok ? await activityRes.json() : [];
    const allSummaries: Summary[] = summariesRes.ok ? await summariesRes.json() : [];
    const teamSummaries = allSummaries.filter((s) => s.teamId === ctx.team.teamId);

    let sparks: Spark[] = [];
    if (sparksRes.ok) {
      const sparksData = await sparksRes.json();
      sparks = sparksData.sparks || [];
    }

    // Get all teams for context
    let allTeams: Team[] = [];
    try {
      const teamsRes = await fetch(`${ctx.serverUrl}/api/orgs/${ctx.orgId}/teams`);
      if (teamsRes.ok) allTeams = await teamsRes.json();
    } catch { /* ignore */ }

    loading.remove();

    // Sparks section (before other content)
    if (sparks.length > 0) {
      view.appendChild(renderSparks(sparks, ctx.team.teamId, allTeams, ctx.serverUrl));
    }

    if (ctx.awareness && ctx.awareness.length > 0) {
      view.appendChild(renderPresence(ctx.awareness));
    }
    view.appendChild(renderMembers(members));
    view.appendChild(renderSummaryContent(teamSummaries));
    view.appendChild(renderLogs(activity, members));
  } catch (err) {
    loading.remove();
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = `Failed to load team details: ${err}`;
    view.appendChild(error);
  }
}
