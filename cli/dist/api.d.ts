import type { Org, Team, Summary, User } from '@campfires/shared';
export declare class ApiClient {
    private serverUrl;
    private token;
    constructor(serverUrl: string, token: string);
    private get;
    fetchOrg(orgId: string): Promise<Org>;
    fetchOrgTeams(orgId: string): Promise<Team[]>;
    fetchOrgSummaries(orgId: string): Promise<Summary[]>;
    fetchTeamMembers(teamId: string): Promise<User[]>;
}
//# sourceMappingURL=api.d.ts.map