import type { Org, Team, Summary } from '@campfires/shared';
import { renderSummaryFeed, updateSummaryFeed } from './components/summary-feed.js';
import { renderDetailView } from './components/detail-view.js';

const SERVER_URL = '';  // Empty string = same origin (proxied by Vite in dev)

// Parse orgId from URL path (/org/{orgId}) or query param (?orgId=...)
function getOrgId(): string | null {
  const pathMatch = window.location.pathname.match(/^\/org\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('orgId');
}

interface AppState {
  org: Org;
  teams: Team[];
  summaries: Summary[];
  eventSource: EventSource | null;
}

const app = document.getElementById('app')!;
let state: AppState | null = null;

function showFeed(): void {
  if (!state) return;

  renderSummaryFeed(app, {
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

  renderDetailView(app, {
    team,
    orgId: state.org.orgId,
    serverUrl: SERVER_URL,
    onBack: showFeed,
  });
}

function connectSSE(orgId: string): EventSource {
  const es = new EventSource(`${SERVER_URL}/api/orgs/${orgId}/summaries/stream`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'update' && data.summaries && state) {
        state.summaries = [...data.summaries, ...state.summaries];
        updateSummaryFeed(app, data.summaries);
      }
    } catch {
      // Ignore parse errors
    }
  };

  es.onerror = () => {
    // EventSource auto-reconnects; nothing extra needed
  };

  return es;
}

async function init(): Promise<void> {
  const orgId = getOrgId();

  if (!orgId) {
    app.innerHTML = '<div class="error">No orgId provided. Use <code>?orgId=...</code> or <code>/org/{orgId}</code> in the URL.</div>';
    return;
  }

  app.innerHTML = '<div class="loading">Loading...</div>';

  try {
    // Fetch org and initial data
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

    state = {
      org,
      teams,
      summaries,
      eventSource: connectSSE(orgId),
    };

    showFeed();
  } catch (err) {
    app.innerHTML = `<div class="error">Failed to connect to server: ${err}</div>`;
  }
}

init();
