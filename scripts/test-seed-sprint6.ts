#!/usr/bin/env npx tsx
/**
 * test-seed-sprint6.ts
 *
 * Seeds the database (via REST API) with test data for Sprint 6
 * cross-team observation & campfire visits.
 *
 * Prerequisites:
 *   1. Server running: cd server && npm run dev
 *
 * Usage:
 *   npx tsx scripts/test-seed-sprint6.ts [--server-url http://localhost:3000]
 *
 * Creates:
 *   - 1 org: "Wagonwheel Studios"
 *   - 3 teams: Frontend Forge, Backend Bastion, Platform Pyre
 *   - 2 users per team (6 total)
 *   - 1 summary per team
 *   - Prints all IDs, tokens, and suggested test commands
 */

const SERVER_URL = process.argv.includes('--server-url')
  ? process.argv[process.argv.indexOf('--server-url') + 1]
  : 'http://localhost:3000';

interface ApiUser {
  userId: string;
  email: string;
  displayName: string;
  avatarColor: string;
  teamId: string;
  orgId: string;
  type: string;
}

interface ApiTeam {
  teamId: string;
  orgId: string;
  name: string;
  description: string;
  inviteCode: string;
}

interface ApiOrg {
  orgId: string;
  name: string;
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${SERVER_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function signup(email: string, password: string, displayName: string) {
  return api<{ user: ApiUser; token: string }>('POST', '/auth/signup', {
    email,
    password,
    displayName,
  });
}

async function createOrg(token: string, name: string, mission: string, roadmap: string) {
  return api<ApiOrg>('POST', '/orgs', { name, mission, roadmap }, token);
}

async function createTeam(token: string, orgId: string, name: string, description: string) {
  return api<ApiTeam>('POST', '/teams', { orgId, name, description }, token);
}

async function joinTeam(token: string, inviteCode: string) {
  return api<{ team: ApiTeam; user: ApiUser; token: string }>(
    'POST',
    '/teams/join',
    { inviteCode },
    token,
  );
}

// ────────────────────────────────────────────

const USERS = [
  // Team 1: Frontend Forge
  { email: 'alice@test.campfires', password: 'test1234', name: 'Alice Chen' },
  { email: 'bob@test.campfires', password: 'test1234', name: 'Bob Martinez' },
  // Team 2: Backend Bastion
  { email: 'carol@test.campfires', password: 'test1234', name: 'Carol Okafor' },
  { email: 'dave@test.campfires', password: 'test1234', name: 'Dave Kim' },
  // Team 3: Platform Pyre
  { email: 'eve@test.campfires', password: 'test1234', name: 'Eve Johansson' },
  { email: 'frank@test.campfires', password: 'test1234', name: 'Frank Nguyen' },
];

const TEAMS = [
  { name: 'Frontend Forge', description: 'UI, design system, and web client', members: [0, 1] },
  { name: 'Backend Bastion', description: 'APIs, data layer, and infrastructure', members: [2, 3] },
  { name: 'Platform Pyre', description: 'CI/CD, observability, and developer tools', members: [4, 5] },
];

async function main() {
  console.log(`\n  Seeding test data against ${SERVER_URL}\n`);

  // 1. Sign up all users
  console.log('  Creating users...');
  const signups = await Promise.all(
    USERS.map((u) => signup(u.email, u.password, u.name)),
  );
  const tokens = signups.map((s) => s.token);
  const users = signups.map((s) => s.user);

  // 2. Create org (first user creates it)
  console.log('  Creating org...');
  const org = await createOrg(
    tokens[0],
    'Wagonwheel Studios',
    'Build tools that make developers feel like a team, not a Slack channel.',
    'Sprint 6: Cross-team observation & campfire visits',
  );

  // 3. Create teams (first member of each team creates it — auto-joins)
  console.log('  Creating teams...');
  const createdTeams: ApiTeam[] = [];
  for (const teamDef of TEAMS) {
    const creatorIdx = teamDef.members[0];
    const team = await createTeam(tokens[creatorIdx], org.orgId, teamDef.name, teamDef.description);
    createdTeams.push(team);

    // Join remaining members
    for (const memberIdx of teamDef.members.slice(1)) {
      const result = await joinTeam(tokens[memberIdx], team.inviteCode);
      tokens[memberIdx] = result.token; // updated token with teamId
      users[memberIdx] = result.user;
    }
  }

  // Refresh first-member tokens by re-logging in (they already joined via createTeam)
  for (const teamDef of TEAMS) {
    const creatorIdx = teamDef.members[0];
    const loginRes = await api<{ user: ApiUser; token: string }>('POST', '/auth/login', {
      email: USERS[creatorIdx].email,
      password: USERS[creatorIdx].password,
    });
    tokens[creatorIdx] = loginRes.token;
    users[creatorIdx] = loginRes.user;
  }

  // 4. Seed some activity events via the Yjs-bypassing agent activity endpoint
  // We'll register an agent for Alice and push a few events
  console.log('  Seeding activity events...');
  for (let ti = 0; ti < createdTeams.length; ti++) {
    const team = createdTeams[ti];
    const memberIdx = TEAMS[ti].members[0];

    // Push events via agent activity endpoint (simplest way without Yjs)
    const agentRes = await api<{ agent: ApiUser; token: string }>(
      'POST',
      '/agents',
      { displayName: `${users[memberIdx].displayName}'s Claude` },
      tokens[memberIdx],
    );

    const events = [
      { type: 'session_start' },
      { type: 'file_open', file: 'src/index.ts' },
      { type: 'file_save', file: 'src/index.ts' },
      { type: 'commit', message: 'feat: initial implementation' },
      { type: 'file_open', file: 'src/utils.ts' },
      { type: 'file_save', file: 'src/utils.ts' },
      { type: 'commit', message: 'refactor: extract helpers' },
    ];

    for (const evt of events) {
      try {
        await api('POST', '/agents/activity', evt, agentRes.token);
      } catch {
        // Rate limited — that's fine for seeding
      }
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  // 5. Print results
  console.log('\n  ════════════════════════════════════════════');
  console.log('  TEST SEED COMPLETE');
  console.log('  ════════════════════════════════════════════\n');

  console.log(`  Org:   ${org.name}  (${org.orgId})\n`);

  for (let ti = 0; ti < createdTeams.length; ti++) {
    const team = createdTeams[ti];
    console.log(`  Team:  ${team.name}  (${team.teamId})`);
    console.log(`         invite: ${team.inviteCode}`);
    for (const mi of TEAMS[ti].members) {
      console.log(`         ${users[mi].displayName} <${users[mi].email}>  (${users[mi].userId})`);
    }
    console.log();
  }

  console.log('  ── Test Commands ──────────────────────────\n');

  console.log(`  Reel (browser):`);
  console.log(`    Open: http://localhost:5173/org/${org.orgId}\n`);

  const aliceToken = tokens[0];
  const carolToken = tokens[2];

  console.log(`  CLI — Alice watches her own campfire:`);
  console.log(`    node cli/dist/index.js watch --server-url ${SERVER_URL}\n`);
  console.log(`    (login as alice@test.campfires / test1234)\n`);

  console.log(`  CLI — Alice visits Backend Bastion:`);
  console.log(`    node cli/dist/index.js watch --server-url ${SERVER_URL} --visit ${createdTeams[1].teamId}\n`);
  console.log(`    (login as alice@test.campfires / test1234)\n`);

  console.log(`  CLI — Carol visits Frontend Forge:`);
  console.log(`    node cli/dist/index.js watch --server-url ${SERVER_URL} --visit ${createdTeams[0].teamId}\n`);
  console.log(`    (login as carol@test.campfires / test1234)\n`);

  console.log(`  Extension:`);
  console.log(`    Sign in as any user, then Cmd+Shift+P → "Campfires: Visit Another Campfire"\n`);

  // Save tokens to a file for convenience
  const tokenData = USERS.map((u, i) => ({
    email: u.email,
    password: u.password,
    name: u.name,
    userId: users[i].userId,
    teamId: users[i].teamId,
    token: tokens[i],
  }));

  const outPath = new URL('./test-seed-sprint6.json', import.meta.url);
  const { writeFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  writeFileSync(fileURLToPath(outPath), JSON.stringify({ org, teams: createdTeams, users: tokenData }, null, 2));
  console.log(`  Tokens + IDs saved to: scripts/test-seed-sprint6.json\n`);
}

main().catch((err) => {
  console.error('\n  Seed failed:', err.message || err);
  process.exit(1);
});
