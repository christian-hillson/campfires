import type {
  Org,
  Team,
  Summary,
  User,
  RegisterAgentResponse,
  AgentActivityRequest,
  ActivityEvent,
} from '@campfires/shared';

export class ApiClient {
  constructor(
    private serverUrl: string,
    private token: string,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.serverUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string };
      throw new Error(err.error || `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown, tokenOverride?: string): Promise<T> {
    const res = await fetch(`${this.serverUrl}/api${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOverride || this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string };
      throw new Error(err.error || `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  fetchOrg(orgId: string): Promise<Org> {
    return this.get<Org>(`/orgs/${orgId}`);
  }

  fetchOrgTeams(orgId: string): Promise<Team[]> {
    return this.get<Team[]>(`/orgs/${orgId}/teams`);
  }

  fetchOrgSummaries(orgId: string): Promise<Summary[]> {
    return this.get<Summary[]>(`/orgs/${orgId}/summaries`);
  }

  fetchTeamMembers(teamId: string): Promise<User[]> {
    return this.get<User[]>(`/teams/${teamId}/members`);
  }

  registerAgent(displayName?: string): Promise<RegisterAgentResponse> {
    return this.post<RegisterAgentResponse>('/agents', { displayName });
  }

  postAgentActivity(agentToken: string, activity: AgentActivityRequest): Promise<ActivityEvent> {
    return this.post<ActivityEvent>('/agents/activity', activity, agentToken);
  }
}
