import type { User, ActivityEvent, Summary, Team, AwarenessState } from '@campfires/shared';

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
  const content = document.createElement('div');
  content.className = 'summary-content';
  content.textContent = latest.content;
  section.appendChild(content);

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
    active: '#3fb950', idle: '#d29922', draft: '#6e7681', visitor: '#58a6ff',
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

function renderActivityList(events: ActivityEvent[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Recent Activity';
  section.appendChild(heading);

  if (events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No recent activity.';
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'activity-list';

  for (const event of events) {
    const item = document.createElement('li');
    item.className = 'activity-item';

    const type = document.createElement('span');
    type.className = 'activity-type';
    type.textContent = event.type.replace('_', ' ');
    item.appendChild(type);

    const message = document.createElement('span');
    message.className = 'activity-message';
    message.textContent = event.message || event.file || event.branch || '';
    item.appendChild(message);

    const time = document.createElement('span');
    time.className = 'activity-time';
    time.textContent = timeAgo(event.timestamp);
    item.appendChild(time);

    list.appendChild(item);
  }

  section.appendChild(list);
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
    const [membersRes, activityRes, summariesRes] = await Promise.all([
      fetch(`${ctx.serverUrl}/api/teams/${ctx.team.teamId}/members`),
      fetch(`${ctx.serverUrl}/api/teams/${ctx.team.teamId}/activity?limit=20`),
      fetch(`${ctx.serverUrl}/api/orgs/${ctx.orgId}/summaries`),
    ]);

    const members: User[] = membersRes.ok ? await membersRes.json() : [];
    const activity: ActivityEvent[] = activityRes.ok ? await activityRes.json() : [];
    const allSummaries: Summary[] = summariesRes.ok ? await summariesRes.json() : [];
    const teamSummaries = allSummaries.filter((s) => s.teamId === ctx.team.teamId);

    loading.remove();

    if (ctx.awareness && ctx.awareness.length > 0) {
      view.appendChild(renderPresence(ctx.awareness));
    }
    view.appendChild(renderMembers(members));
    view.appendChild(renderSummaryContent(teamSummaries));
    view.appendChild(renderActivityList(activity));
  } catch (err) {
    loading.remove();
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = `Failed to load team details: ${err}`;
    view.appendChild(error);
  }
}
