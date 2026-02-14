import type { Org, Team, Summary, AwarenessState, User } from '@campfires/shared';
import { renderSummaryFeed, updateSummaryFeed } from './components/summary-feed.js';
import { renderDetailView } from './components/detail-view.js';
import { renderHeader, type ViewMode } from './components/header.js';
import { MapView } from './map/index.js';

const SERVER_URL = ''; // Empty string = same origin (proxied by Vite in dev)

// Parse orgId from URL path (/org/{orgId}) or query param (?orgId=...)
function getOrgId(): string | null {
  const pathMatch = window.location.pathname.match(/^\/org\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('orgId');
}

export interface AppState {
  org: Org;
  teams: Team[];
  summaries: Summary[];
  members: Map<string, User[]>;
  awareness: Map<string, AwarenessState[]>;
  eventSource: EventSource | null;
  currentView: ViewMode;
}

const app = document.getElementById('app')!;
let state: AppState | null = null;
let mapView: MapView | null = null;
let awarenessInterval: ReturnType<typeof setInterval> | null = null;

function renderCurrentView(): void {
  if (!state) return;

  renderHeader(app, {
    org: state.org,
    activeView: state.currentView,
    onlineCount: getTotalOnline(),
    teamCount: state.teams.length,
    onViewChange: switchView,
  });

  let content = app.querySelector('.stories-content') as HTMLElement | null;
  if (!content) {
    content = document.createElement('div');
    content.className = 'stories-content';
    app.appendChild(content);
  }

  if (state.currentView === 'feed') {
    if (mapView) {
      mapView.stop();
      mapView = null;
    }
    content.classList.remove('map-mode');
    showFeed(content);
  } else {
    content.classList.add('map-mode');
    showMap(content);
  }
}

function getTotalOnline(): number {
  if (!state) return 0;
  let count = 0;
  state.awareness.forEach((states) => {
    count += states.filter((s) => s.status === 'active' || s.status === 'idle').length;
  });
  return count;
}

function switchView(view: ViewMode): void {
  if (!state || state.currentView === view) return;
  state.currentView = view;
  renderCurrentView();
}

function showFeed(content: HTMLElement): void {
  if (!state) return;
  content.innerHTML = '';

  renderSummaryFeed(content, {
    org: state.org,
    teams: state.teams,
    summaries: state.summaries,
    onTeamClick: (teamId) => showDetail(teamId),
  });
}

function showDetail(teamId: string): void {
  if (!state) return;

  const team = state.teams.find((t) => t.teamId === teamId);
  if (!team) return;

  const content = app.querySelector('.stories-content') as HTMLElement;
  if (!content) return;

  renderDetailView(content, {
    team,
    orgId: state.org.orgId,
    serverUrl: SERVER_URL,
    onBack: () => renderCurrentView(),
    awareness: state.awareness.get(teamId),
  });
}

function showMap(content: HTMLElement): void {
  if (!state) return;
  content.innerHTML = '';

  mapView = new MapView(content, {
    org: state.org,
    teams: state.teams,
    summaries: state.summaries,
    members: state.members,
    awareness: state.awareness,
    serverUrl: SERVER_URL,
    onTeamSelect: showDetail,
  });
  mapView.start();
}

function connectSSE(orgId: string): EventSource {
  const es = new EventSource(`${SERVER_URL}/api/orgs/${orgId}/summaries/stream`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'update' && data.summaries && state) {
        state.summaries = [...data.summaries, ...state.summaries];

        const content = app.querySelector('.stories-content');
        if (content && state.currentView === 'feed') {
          updateSummaryFeed(content as HTMLElement, data.summaries);
        }

        if (mapView) {
          mapView.updateSummaries(data.summaries);
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  es.onerror = () => {
    // EventSource auto-reconnects
  };

  return es;
}

async function fetchAllMembers(teams: Team[]): Promise<Map<string, User[]>> {
  const members = new Map<string, User[]>();
  const results = await Promise.all(
    teams.map((t) =>
      fetch(`${SERVER_URL}/api/teams/${t.teamId}/members`)
        .then((r) => (r.ok ? r.json() : []))
        .then((m: User[]) => ({ teamId: t.teamId, members: m })),
    ),
  );
  for (const r of results) {
    members.set(r.teamId, r.members);
  }
  return members;
}

async function fetchAllAwareness(teams: Team[]): Promise<Map<string, AwarenessState[]>> {
  const awareness = new Map<string, AwarenessState[]>();
  const results = await Promise.all(
    teams.map((t) =>
      fetch(`${SERVER_URL}/api/teams/${t.teamId}/awareness`)
        .then((r) => (r.ok ? r.json() : []))
        .then((a: AwarenessState[]) => ({ teamId: t.teamId, awareness: a })),
    ),
  );
  for (const r of results) {
    awareness.set(r.teamId, r.awareness);
  }
  return awareness;
}

function startAwarenessPolling(teams: Team[]): void {
  if (awarenessInterval) clearInterval(awarenessInterval);

  awarenessInterval = setInterval(async () => {
    if (!state) return;
    state.awareness = await fetchAllAwareness(teams);

    renderHeader(app, {
      org: state.org,
      activeView: state.currentView,
      onlineCount: getTotalOnline(),
      teamCount: state.teams.length,
      onViewChange: switchView,
    });

    if (mapView) {
      mapView.updateAwareness(state.awareness);
    }
  }, 10000);
}

async function init(): Promise<void> {
  const orgId = getOrgId();

  if (!orgId) {
    app.innerHTML =
      '<div class="error">No orgId provided. Use <code>?orgId=...</code> or <code>/org/{orgId}</code> in the URL.</div>';
    return;
  }

  app.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const [orgRes, teamsRes, summariesRes] = await Promise.all([
      fetch(`${SERVER_URL}/api/orgs/${orgId}`),
      fetch(`${SERVER_URL}/api/orgs/${orgId}/teams`),
      fetch(`${SERVER_URL}/api/orgs/${orgId}/summaries`),
    ]);

    if (!orgRes.ok) {
      app.innerHTML = `<div class="error">Org not found (${orgRes.status}). Check the orgId.</div>`;
      return;
    }

    const org: Org = await orgRes.json();
    const teams: Team[] = teamsRes.ok ? await teamsRes.json() : [];
    const summaries: Summary[] = summariesRes.ok ? await summariesRes.json() : [];

    const [members, awareness] = await Promise.all([
      fetchAllMembers(teams),
      fetchAllAwareness(teams),
    ]);

    state = {
      org,
      teams,
      summaries,
      members,
      awareness,
      eventSource: connectSSE(orgId),
      currentView: 'feed',
    };

    app.innerHTML = '';
    renderCurrentView();
    startAwarenessPolling(teams);
  } catch (err) {
    app.innerHTML = `<div class="error">Failed to connect to server: ${err}</div>`;
  }
}

init();
