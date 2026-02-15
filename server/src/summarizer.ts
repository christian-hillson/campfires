import Anthropic from '@anthropic-ai/sdk';
import type { ActivityEvent, SessionTranscript, Team, User } from '@campfires/shared';
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

// --- Transcript preprocessing ---

// TODO: refine as we learn the exact transcript schema
function preprocessTranscript(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return content;

  // Check if this looks like JSONL — first non-empty line should parse as JSON
  try {
    JSON.parse(lines[0]);
  } catch {
    // Not JSONL, return as-is
    return content;
  }

  const output: string[] = [];

  for (const line of lines) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      // Skip unparseable lines
      continue;
    }

    const role = obj.role as string | undefined;

    // Handle message objects with a role field
    if (role === 'user') {
      const text = extractText(obj);
      if (text) output.push(`[User] ${text}`);
      continue;
    }

    if (role === 'assistant') {
      const contentArr = obj.content;
      if (Array.isArray(contentArr)) {
        for (const block of contentArr) {
          const b = block as Record<string, unknown>;
          if (b.type === 'text' && typeof b.text === 'string') {
            output.push(`[Assistant] ${b.text}`);
          } else if (b.type === 'tool_use') {
            const toolName = (b.name as string) || 'unknown';
            const inputSummary = summarizeToolInput(toolName, b.input as Record<string, unknown>);
            output.push(`[Tool] ${toolName}: ${inputSummary}`);
          }
        }
      } else {
        const text = extractText(obj);
        if (text) output.push(`[Assistant] ${text}`);
      }
      continue;
    }

    // Drop tool_result / tool role messages entirely (verbose outputs)
    if (role === 'tool') continue;

    // Handle nested message wrapper: { type: "message", message: { role, content } }
    if (obj.type === 'message' && typeof obj.message === 'object' && obj.message !== null) {
      const inner = obj.message as Record<string, unknown>;
      const preprocessed = preprocessTranscript(JSON.stringify(inner));
      if (preprocessed.trim()) output.push(preprocessed);
      continue;
    }
  }

  // If we parsed lines but got no output, return original content
  return output.length > 0 ? output.join('\n') : content;
}

function extractText(obj: Record<string, unknown>): string {
  // Simple string content
  if (typeof obj.content === 'string') return obj.content;

  // Content array with text blocks
  if (Array.isArray(obj.content)) {
    const texts = (obj.content as Record<string, unknown>[])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string);
    return texts.join('\n');
  }

  return '';
}

function summarizeToolInput(toolName: string, input: Record<string, unknown> | undefined): string {
  if (!input) return '';

  // Common tool patterns from Claude Code
  const lowerName = toolName.toLowerCase();
  if (lowerName === 'read' || lowerName.includes('read')) {
    return (input.file_path as string) || (input.path as string) || '';
  }
  if (lowerName === 'edit' || lowerName.includes('edit')) {
    return (input.file_path as string) || (input.path as string) || '';
  }
  if (lowerName === 'write' || lowerName.includes('write')) {
    return (input.file_path as string) || (input.path as string) || '';
  }
  if (lowerName === 'bash' || lowerName.includes('bash')) {
    const cmd = (input.command as string) || '';
    // Truncate long commands
    return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
  }
  if (lowerName === 'glob' || lowerName.includes('glob')) {
    return (input.pattern as string) || '';
  }
  if (lowerName === 'grep' || lowerName.includes('grep')) {
    return (input.pattern as string) || '';
  }

  // Fallback: show first string value
  for (const val of Object.values(input)) {
    if (typeof val === 'string' && val.length > 0) {
      return val.length > 80 ? val.slice(0, 80) + '...' : val;
    }
  }
  return '';
}

// --- Transcript data formatting ---

const MAX_TRANSCRIPT_BYTES = 50 * 1024;
const MAX_TOTAL_TRANSCRIPT_BYTES = 150 * 1024;

function prepareTranscriptData(transcripts: SessionTranscript[], members?: User[]): string {
  if (transcripts.length === 0) return '';

  // Build userId → displayName map if members provided
  const nameMap = new Map<string, string>();
  if (members) {
    for (const m of members) {
      nameMap.set(m.userId, m.displayName);
    }
  }

  const lines: string[] = [];
  let totalBytes = 0;

  // Work backwards from most recent to fit within budget
  const reversed = [...transcripts].reverse();

  const included: string[] = [];
  for (const t of reversed) {
    const cleaned = preprocessTranscript(t.content);
    const truncatedContent =
      cleaned.length > MAX_TRANSCRIPT_BYTES
        ? cleaned.slice(0, MAX_TRANSCRIPT_BYTES) + '\n... [truncated]'
        : cleaned;

    const userName = nameMap.get(t.userId) || t.userId;

    const block = [
      `--- Session: ${t.sessionId} ---`,
      `User: ${userName}`,
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
  members?: User[],
): Promise<SummaryResult> {
  const client = getAnthropicClient()!;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20250514';
  const eventData = prepareEventData(events);
  const transcriptData = prepareTranscriptData(transcripts, members);

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
  members?: User[],
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
    return await callClaude(events, transcripts, orgContext, teamContext, members);
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
    const members = db.getTeamMembers(team.teamId);

    const { content, oneLiner } = await generateSummary(
      events,
      transcripts,
      orgContext,
      teamContext,
      members,
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
