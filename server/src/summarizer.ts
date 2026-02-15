import Anthropic from '@anthropic-ai/sdk';
import type { ActivityEvent, SessionTranscript, Team } from '@campfires/shared';
import { CONFIG } from '@campfires/shared';
import { getPersistence } from './persistence.js';

interface SummaryResult {
  content: string;
  oneLiner: string;
}

// --- Stub (fallback) summary generator ---

function generateStubSummary(
  events: ActivityEvent[],
  transcripts: SessionTranscript[],
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
  if (transcripts.length > 0) {
    parts.push(`${transcripts.length} session transcript${transcripts.length !== 1 ? 's' : ''}`);
  }

  const devWord = uniqueUsers.size === 1 ? 'developer' : 'developers';
  const oneLiner =
    parts.length > 0
      ? `${parts.join(', ')} by ${uniqueUsers.size} ${devWord}`
      : `${transcripts.length} session transcript${transcripts.length !== 1 ? 's' : ''}`;

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

// --- Anthropic client singleton ---

let anthropicClient: Anthropic | null = null;
let loggedNoKey = false;

function getAnthropicClient(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropicClient = new Anthropic();
  return anthropicClient;
}

// --- Event data formatting ---

function prepareEventData(events: ActivityEvent[]): string {
  const commits = events.filter((e) => e.type === 'commit');
  const uniqueUsers = new Set(events.map((e) => e.userId));
  const uniqueFiles = new Set(events.filter((e) => e.file).map((e) => e.file));
  const branches = new Set(events.filter((e) => e.branch).map((e) => e.branch));
  const sessionStarts = events.filter((e) => e.type === 'session_start').length;

  const lines: string[] = [];

  lines.push(`Developers: ${uniqueUsers.size}`);
  lines.push(`Sessions: ${sessionStarts}`);
  lines.push(`Total events: ${events.length}`);
  lines.push('');

  if (commits.length > 0) {
    lines.push('Commits:');
    for (const c of commits.slice(0, 20)) {
      const branch = c.branch ? ` (${c.branch})` : '';
      lines.push(`- ${c.message || 'no message'}${branch}`);
    }
    if (commits.length > 20) {
      lines.push(`  ...and ${commits.length - 20} more commits`);
    }
    lines.push('');
  }

  if (uniqueFiles.size > 0) {
    const fileList = [...uniqueFiles].slice(0, 30);
    lines.push(`Files modified (${uniqueFiles.size} total):`);
    for (const f of fileList) {
      lines.push(`- ${f}`);
    }
    if (uniqueFiles.size > 30) {
      lines.push(`  ...and ${uniqueFiles.size - 30} more files`);
    }
    lines.push('');
  }

  if (branches.size > 0) {
    lines.push(`Active branches: ${[...branches].join(', ')}`);
  }

  return lines.join('\n');
}

// --- Transcript data formatting ---

const MAX_TRANSCRIPT_BYTES = 50 * 1024;
const MAX_TOTAL_TRANSCRIPT_BYTES = 150 * 1024;

function prepareTranscriptData(transcripts: SessionTranscript[]): string {
  if (transcripts.length === 0) return '';

  const lines: string[] = [];
  let totalBytes = 0;

  // Work backwards from most recent to fit within budget
  const reversed = [...transcripts].reverse();

  const included: string[] = [];
  for (const t of reversed) {
    const truncatedContent =
      t.content.length > MAX_TRANSCRIPT_BYTES
        ? t.content.slice(0, MAX_TRANSCRIPT_BYTES) + '\n... [truncated]'
        : t.content;

    const block = [
      `--- Session: ${t.sessionId} ---`,
      `User: ${t.userId}`,
      t.repo ? `Repo: ${t.repo}` : null,
      t.branch ? `Branch: ${t.branch}` : null,
      `Time: ${t.createdAt} → ${t.updatedAt}`,
      `Status: ${t.isComplete ? 'complete' : 'in-progress'}`,
      '',
      truncatedContent,
      '',
    ]
      .filter((l) => l !== null)
      .join('\n');

    if (totalBytes + block.length > MAX_TOTAL_TRANSCRIPT_BYTES && included.length > 0) {
      break;
    }
    totalBytes += block.length;
    included.push(block);
  }

  // Reverse back to chronological order
  included.reverse();

  lines.push(`Session transcripts (${transcripts.length} total, ${included.length} included):`);
  lines.push('');
  lines.push(...included);

  if (included.length < transcripts.length) {
    lines.push(`... ${transcripts.length - included.length} older transcripts omitted for space`);
  }

  return lines.join('\n');
}

// --- Claude API call ---

async function callClaude(
  events: ActivityEvent[],
  transcripts: SessionTranscript[],
  orgContext: { mission: string; roadmap: string },
  teamContext: { name: string; description: string },
): Promise<SummaryResult> {
  const client = getAnthropicClient()!;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20250514';
  const eventData = prepareEventData(events);
  const transcriptData = prepareTranscriptData(transcripts);

  const systemPrompt = `You are the Campfires activity summarizer. Your job is to turn developer activity data into concise, business-legible project summaries.

You will receive two types of data:
1. **Session transcripts** — full records of developer coding sessions, showing what was discussed, decided, and accomplished. This is your PRIMARY source of insight.
2. **Activity events** — structured signals like commits, file saves, and branch switches. Use these as supporting context (which files changed, how many commits).

Prioritize transcript content over raw events. Transcripts reveal the narrative — what developers were working on, what problems they solved, and what decisions they made. Events provide quantitative backing.

Respond with a JSON object containing exactly two fields:
- "oneLiner": A single-line summary under 80 characters, no markdown formatting. Capture the most significant accomplishment or focus area.
- "content": A markdown summary of 2-4 paragraphs, under 500 words. Write a narrative of progress — what was accomplished, what challenges were addressed, and what direction the work is heading. Write for a non-technical audience who wants to understand project progress.

Respond ONLY with valid JSON. No other text.`;

  let userMessage = `Team: ${teamContext.name}`;
  if (teamContext.description) {
    userMessage += `\nTeam description: ${teamContext.description}`;
  }
  if (orgContext.mission) {
    userMessage += `\nOrg mission: ${orgContext.mission}`;
  }
  if (orgContext.roadmap) {
    userMessage += `\nOrg roadmap: ${orgContext.roadmap}`;
  }
  if (transcriptData) {
    userMessage += `\n\n${transcriptData}`;
  }
  userMessage += `\n\nActivity events:\n${eventData}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  const parsed = JSON.parse(textBlock.text);
  if (typeof parsed.oneLiner !== 'string' || typeof parsed.content !== 'string') {
    throw new Error('Claude response missing required oneLiner or content fields');
  }

  return { oneLiner: parsed.oneLiner, content: parsed.content };
}

// --- Main generateSummary (async, with fallback) ---

async function generateSummary(
  events: ActivityEvent[],
  transcripts: SessionTranscript[],
  orgContext: { mission: string; roadmap: string },
  teamContext: { name: string; description: string },
): Promise<SummaryResult> {
  const client = getAnthropicClient();
  if (!client) {
    if (!loggedNoKey) {
      console.log('[Summarizer] No ANTHROPIC_API_KEY set, will use stub summaries');
      loggedNoKey = true;
    }
    return generateStubSummary(events, transcripts, orgContext, teamContext);
  }

  try {
    return await callClaude(events, transcripts, orgContext, teamContext);
  } catch (err) {
    console.error('[Summarizer] Claude API error, falling back to stub:', err);
    return generateStubSummary(events, transcripts, orgContext, teamContext);
  }
}

export { generateSummary, generateStubSummary };

export class Summarizer {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    console.log(`[Summarizer] Starting with ${CONFIG.SUMMARIZATION_INTERVAL / 1000}s interval`);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[Summarizer] No ANTHROPIC_API_KEY set — summaries will use stub generator');
    }

    this.intervalId = setInterval(() => {
      this.runOnce().catch((err) => {
        console.error('[Summarizer] Error during scheduled run:', err);
      });
    }, CONFIG.SUMMARIZATION_INTERVAL);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Summarizer] Stopped');
    }
  }

  async runOnce(): Promise<void> {
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
        summariesCreated += await this.summarizeTeam(team, db);
      } catch (err) {
        console.error(`[Summarizer] Error summarizing team ${team.name}:`, err);
      }
    }

    console.log(`[Summarizer] Done — created ${summariesCreated} summaries`);
  }

  private async summarizeTeam(team: Team, db: ReturnType<typeof getPersistence>): Promise<number> {
    const lastSummaryTime = db.getLatestSummaryTime(team.teamId);
    const since = lastSummaryTime || new Date(0).toISOString();

    const events = db
      .getActivityEventsSince(since, team.orgId)
      .filter((e) => e.teamId === team.teamId);

    const transcripts = db.getTranscriptsByTeam(team.teamId, since);

    if (events.length === 0 && transcripts.length === 0) {
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

    const { content, oneLiner } = await generateSummary(
      events,
      transcripts,
      orgContext,
      teamContext,
    );

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

    console.log(
      `[Summarizer] Created summary for team "${team.name}" (${events.length} events, ${transcripts.length} transcripts)`,
    );
    return 1;
  }
}
