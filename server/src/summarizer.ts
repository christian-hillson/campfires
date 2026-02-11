import type { ActivityEvent, Team } from '@campfires/shared';
import { CONFIG } from '@campfires/shared';
import { getPersistence } from './persistence.js';

interface SummaryResult {
  content: string;
  oneLiner: string;
}

/**
 * Generate a summary from activity events.
 * Stubbed implementation — returns a mock summary from event data.
 * Replace this function with real Claude API calls later.
 */
export function generateSummary(
  events: ActivityEvent[],
  _orgContext: { mission: string; roadmap: string },
  teamContext: { name: string; description: string },
): SummaryResult {
  const commits = events.filter((e) => e.type === 'commit');
  const fileSaves = events.filter((e) => e.type === 'file_save');
  const branchSwitches = events.filter((e) => e.type === 'branch_switch');
  const uniqueUsers = new Set(events.map((e) => e.userId));

  const parts: string[] = [];

  if (commits.length > 0) {
    parts.push(`${commits.length} commit${commits.length !== 1 ? 's' : ''}`);
  }
  if (fileSaves.length > 0) {
    parts.push(`${fileSaves.length} file save${fileSaves.length !== 1 ? 's' : ''}`);
  }
  if (branchSwitches.length > 0) {
    parts.push(`${branchSwitches.length} branch switch${branchSwitches.length !== 1 ? 'es' : ''}`);
  }

  const devWord = uniqueUsers.size === 1 ? 'developer' : 'developers';
  const oneLiner = `${parts.join(', ')} by ${uniqueUsers.size} ${devWord}`;

  const commitMessages = commits
    .filter((e) => e.message)
    .map((e) => `- ${e.message}`)
    .slice(0, 10);

  const uniqueFiles = new Set(events.filter((e) => e.file).map((e) => e.file));
  const branches = new Set(events.filter((e) => e.branch).map((e) => e.branch));

  let content = `## ${teamContext.name} Activity Summary\n\n`;
  content += `**${oneLiner}**\n\n`;

  if (commitMessages.length > 0) {
    content += `### Recent Commits\n${commitMessages.join('\n')}\n\n`;
  }

  if (uniqueFiles.size > 0) {
    content += `### Files Touched\n${uniqueFiles.size} unique file${uniqueFiles.size !== 1 ? 's' : ''} modified\n\n`;
  }

  if (branches.size > 0) {
    content += `### Active Branches\n${[...branches].join(', ')}\n`;
  }

  return { content, oneLiner };
}

export class Summarizer {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    console.log(`[Summarizer] Starting with ${CONFIG.SUMMARIZATION_INTERVAL / 1000}s interval`);
    this.intervalId = setInterval(() => {
      this.runOnce();
    }, CONFIG.SUMMARIZATION_INTERVAL);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Summarizer] Stopped');
    }
  }

  runOnce(): void {
    console.log('[Summarizer] Running summarization...');
    const db = getPersistence();

    const teams = db.getAllTeams();
    if (teams.length === 0) {
      console.log('[Summarizer] No teams found, skipping');
      return;
    }

    let summariesCreated = 0;

    for (const team of teams) {
      try {
        summariesCreated += this.summarizeTeam(team, db);
      } catch (err) {
        console.error(`[Summarizer] Error summarizing team ${team.name}:`, err);
      }
    }

    console.log(`[Summarizer] Done — created ${summariesCreated} summaries`);
  }

  private summarizeTeam(team: Team, db: ReturnType<typeof getPersistence>): number {
    const lastSummaryTime = db.getLatestSummaryTime(team.teamId);
    const since = lastSummaryTime || new Date(0).toISOString();

    const events = db
      .getActivityEventsSince(since, team.orgId)
      .filter((e) => e.teamId === team.teamId);

    if (events.length === 0) {
      return 0;
    }

    const org = db.getOrg(team.orgId);
    const orgContext = {
      mission: org?.mission || '',
      roadmap: org?.roadmap || '',
    };
    const teamContext = {
      name: team.name,
      description: team.description,
    };

    const { content, oneLiner } = generateSummary(events, orgContext, teamContext);

    const periodStart = since;
    const periodEnd = new Date().toISOString();

    db.createSummary(
      team.orgId,
      team.teamId,
      periodStart,
      periodEnd,
      content,
      oneLiner,
      events.length,
    );

    console.log(`[Summarizer] Created summary for team "${team.name}" (${events.length} events)`);
    return 1;
  }
}
