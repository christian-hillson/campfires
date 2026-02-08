"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
class ApiClient {
    serverUrl;
    token;
    constructor(serverUrl, token) {
        this.serverUrl = serverUrl;
        this.token = token;
    }
    async get(path) {
        const res = await fetch(`${this.serverUrl}/api${path}`, {
            headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `API error: ${res.status}`);
        }
        return res.json();
    }
    fetchOrg(orgId) {
        return this.get(`/orgs/${orgId}`);
    }
    fetchOrgTeams(orgId) {
        return this.get(`/orgs/${orgId}/teams`);
    }
    fetchOrgSummaries(orgId) {
        return this.get(`/orgs/${orgId}/summaries`);
    }
    fetchTeamMembers(teamId) {
        return this.get(`/teams/${teamId}/members`);
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=api.js.map