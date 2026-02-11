import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type {
  User,
  Org,
  Team,
  TeamWithMembers,
  ActivityEvent,
  Summary,
  UserType,
  ActivityEventType,
} from '@campfires/shared';

const AVATAR_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
  '#F8B500',
  '#00CED1',
];

export class Persistence {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Organizations
      CREATE TABLE IF NOT EXISTS orgs (
        orgId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mission TEXT DEFAULT '',
        roadmap TEXT DEFAULT '',
        createdAt TEXT NOT NULL
      );

      -- Teams
      CREATE TABLE IF NOT EXISTS teams (
        teamId TEXT PRIMARY KEY,
        orgId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        inviteCode TEXT UNIQUE NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (orgId) REFERENCES orgs(orgId)
      );

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        displayName TEXT NOT NULL,
        avatarColor TEXT NOT NULL,
        teamId TEXT,
        orgId TEXT,
        type TEXT NOT NULL DEFAULT 'human',
        createdAt TEXT NOT NULL,
        FOREIGN KEY (teamId) REFERENCES teams(teamId),
        FOREIGN KEY (orgId) REFERENCES orgs(orgId)
      );

      -- Activity Log (append-only)
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        userId TEXT NOT NULL,
        userType TEXT NOT NULL,
        teamId TEXT NOT NULL,
        type TEXT NOT NULL,
        file TEXT,
        branch TEXT,
        message TEXT,
        metadata TEXT,
        FOREIGN KEY (userId) REFERENCES users(userId),
        FOREIGN KEY (teamId) REFERENCES teams(teamId)
      );

      -- Summaries
      CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        orgId TEXT NOT NULL,
        teamId TEXT NOT NULL,
        periodStart TEXT NOT NULL,
        periodEnd TEXT NOT NULL,
        content TEXT NOT NULL,
        eventCount INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (orgId) REFERENCES orgs(orgId),
        FOREIGN KEY (teamId) REFERENCES teams(teamId)
      );

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_activity_log_team_timestamp
        ON activity_log(teamId, timestamp);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user_timestamp
        ON activity_log(userId, timestamp);
      CREATE INDEX IF NOT EXISTS idx_summaries_org_created
        ON summaries(orgId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_teams_invite_code
        ON teams(inviteCode);
      CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email);
    `);

    // Migrations for parentUserId (idempotent)
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN parentUserId TEXT`);
    } catch {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE activity_log ADD COLUMN parentUserId TEXT`);
    } catch {
      // Column already exists
    }
    // Migration for oneLiner on summaries
    try {
      this.db.exec(`ALTER TABLE summaries ADD COLUMN oneLiner TEXT DEFAULT ''`);
    } catch {
      // Column already exists
    }
  }

  // ============================================
  // Org Operations
  // ============================================

  createOrg(name: string, mission: string = '', roadmap: string = ''): Org {
    const orgId = uuidv4();
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO orgs (orgId, name, mission, roadmap, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(orgId, name, mission, roadmap, createdAt);

    return { orgId, name, mission, roadmap, createdAt };
  }

  getOrg(orgId: string): Org | null {
    const row = this.db
      .prepare(
        `
      SELECT orgId, name, mission, roadmap, createdAt
      FROM orgs WHERE orgId = ?
    `,
      )
      .get(orgId) as Org | undefined;

    return row || null;
  }

  updateOrg(
    orgId: string,
    updates: Partial<Pick<Org, 'name' | 'mission' | 'roadmap'>>,
  ): Org | null {
    const org = this.getOrg(orgId);
    if (!org) return null;

    const name = updates.name ?? org.name;
    const mission = updates.mission ?? org.mission;
    const roadmap = updates.roadmap ?? org.roadmap;

    this.db
      .prepare(
        `
      UPDATE orgs SET name = ?, mission = ?, roadmap = ?
      WHERE orgId = ?
    `,
      )
      .run(name, mission, roadmap, orgId);

    return { ...org, name, mission, roadmap };
  }

  // ============================================
  // Team Operations
  // ============================================

  createTeam(orgId: string, name: string, description: string = ''): Team {
    const teamId = uuidv4();
    const inviteCode = this.generateInviteCode();
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO teams (teamId, orgId, name, description, inviteCode, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(teamId, orgId, name, description, inviteCode, createdAt);

    return { teamId, orgId, name, description, inviteCode, createdAt };
  }

  getTeam(teamId: string): Team | null {
    const row = this.db
      .prepare(
        `
      SELECT teamId, orgId, name, description, inviteCode, createdAt
      FROM teams WHERE teamId = ?
    `,
      )
      .get(teamId) as Team | undefined;

    return row || null;
  }

  getTeamByInviteCode(inviteCode: string): Team | null {
    const row = this.db
      .prepare(
        `
      SELECT teamId, orgId, name, description, inviteCode, createdAt
      FROM teams WHERE inviteCode = ?
    `,
      )
      .get(inviteCode) as Team | undefined;

    return row || null;
  }

  getTeamsByOrg(orgId: string): Team[] {
    return this.db
      .prepare(
        `
      SELECT teamId, orgId, name, description, inviteCode, createdAt
      FROM teams WHERE orgId = ?
    `,
      )
      .all(orgId) as Team[];
  }

  getAllTeams(): Team[] {
    return this.db
      .prepare(
        `
      SELECT teamId, orgId, name, description, inviteCode, createdAt
      FROM teams
    `,
      )
      .all() as Team[];
  }

  getTeamWithMembers(teamId: string): TeamWithMembers | null {
    const team = this.getTeam(teamId);
    if (!team) return null;

    const members = this.getTeamMembers(teamId);
    return { ...team, members };
  }

  getTeamMembers(teamId: string): User[] {
    return this.db
      .prepare(
        `
      SELECT userId, email, displayName, avatarColor, teamId, orgId, type, parentUserId, createdAt
      FROM users WHERE teamId = ?
    `,
      )
      .all(teamId) as User[];
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ============================================
  // User Operations
  // ============================================

  createUser(
    email: string,
    passwordHash: string,
    displayName: string,
    type: UserType = 'human',
  ): User {
    const userId = uuidv4();
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO users (userId, email, passwordHash, displayName, avatarColor, type, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(userId, email, passwordHash, displayName, avatarColor, type, createdAt);

    return {
      userId,
      email,
      displayName,
      avatarColor,
      teamId: '',
      orgId: '',
      type,
      parentUserId: null,
      createdAt,
    };
  }

  getUser(userId: string): User | null {
    const row = this.db
      .prepare(
        `
      SELECT userId, email, displayName, avatarColor, teamId, orgId, type, parentUserId, createdAt
      FROM users WHERE userId = ?
    `,
      )
      .get(userId) as
      | (User & { teamId: string | null; orgId: string | null; parentUserId: string | null })
      | undefined;

    if (!row) return null;
    return {
      ...row,
      teamId: row.teamId || '',
      orgId: row.orgId || '',
      parentUserId: row.parentUserId || null,
    };
  }

  getUserByEmail(email: string): (User & { passwordHash: string }) | null {
    const row = this.db
      .prepare(
        `
      SELECT userId, email, passwordHash, displayName, avatarColor, teamId, orgId, type, parentUserId, createdAt
      FROM users WHERE email = ?
    `,
      )
      .get(email) as
      | (User & {
          passwordHash: string;
          teamId: string | null;
          orgId: string | null;
          parentUserId: string | null;
        })
      | undefined;

    if (!row) return null;
    return {
      ...row,
      teamId: row.teamId || '',
      orgId: row.orgId || '',
      parentUserId: row.parentUserId || null,
    };
  }

  updateUserPasswordHash(userId: string, newHash: string): void {
    this.db
      .prepare(
        `
      UPDATE users SET passwordHash = ?
      WHERE userId = ?
    `,
      )
      .run(newHash, userId);
  }

  updateUserTeam(userId: string, teamId: string, orgId: string): void {
    this.db
      .prepare(
        `
      UPDATE users SET teamId = ?, orgId = ?
      WHERE userId = ?
    `,
      )
      .run(teamId, orgId, userId);
  }

  createAgentUser(parentUserId: string, displayName: string, teamId: string, orgId: string): User {
    const userId = uuidv4();
    const email = `agent-${userId}@campfires.local`;
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO users (userId, email, passwordHash, displayName, avatarColor, teamId, orgId, type, parentUserId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        userId,
        email,
        '',
        displayName,
        avatarColor,
        teamId,
        orgId,
        'agent',
        parentUserId,
        createdAt,
      );

    return {
      userId,
      email,
      displayName,
      avatarColor,
      teamId,
      orgId,
      type: 'agent',
      parentUserId,
      createdAt,
    };
  }

  // ============================================
  // Activity Log Operations (Append-Only)
  // ============================================

  appendActivityEvent(event: Omit<ActivityEvent, 'id' | 'timestamp'>): ActivityEvent {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const metadata = event.metadata ? JSON.stringify(event.metadata) : null;

    this.db
      .prepare(
        `
      INSERT INTO activity_log (id, timestamp, userId, userType, parentUserId, teamId, type, file, branch, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        timestamp,
        event.userId,
        event.userType,
        event.parentUserId,
        event.teamId,
        event.type,
        event.file,
        event.branch,
        event.message,
        metadata,
      );

    return {
      id,
      timestamp,
      userId: event.userId,
      userType: event.userType,
      parentUserId: event.parentUserId,
      teamId: event.teamId,
      type: event.type,
      file: event.file,
      branch: event.branch,
      message: event.message,
      metadata: event.metadata,
    };
  }

  getActivityEvents(
    teamId: string,
    options: {
      since?: string;
      limit?: number;
      types?: ActivityEventType[];
    } = {},
  ): ActivityEvent[] {
    const { since, limit = 100, types } = options;

    let query = `
      SELECT id, timestamp, userId, userType, parentUserId, teamId, type, file, branch, message, metadata
      FROM activity_log
      WHERE teamId = ?
    `;
    const params: (string | number)[] = [teamId];

    if (since) {
      query += ` AND timestamp > ?`;
      params.push(since);
    }

    if (types && types.length > 0) {
      query += ` AND type IN (${types.map(() => '?').join(', ')})`;
      params.push(...types);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: string;
      timestamp: string;
      userId: string;
      userType: UserType;
      parentUserId: string | null;
      teamId: string;
      type: ActivityEventType;
      file: string | null;
      branch: string | null;
      message: string | null;
      metadata: string | null;
    }>;

    return rows.map((row) => ({
      ...row,
      parentUserId: row.parentUserId || null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  }

  getActivityEventsSince(since: string, orgId?: string): ActivityEvent[] {
    let query = `
      SELECT al.id, al.timestamp, al.userId, al.userType, al.parentUserId, al.teamId, al.type, al.file, al.branch, al.message, al.metadata
      FROM activity_log al
    `;
    const params: string[] = [since];

    if (orgId) {
      query += ` JOIN teams t ON al.teamId = t.teamId WHERE t.orgId = ? AND al.timestamp > ?`;
      params.unshift(orgId);
    } else {
      query += ` WHERE al.timestamp > ?`;
    }

    query += ` ORDER BY al.timestamp ASC`;

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: string;
      timestamp: string;
      userId: string;
      userType: UserType;
      parentUserId: string | null;
      teamId: string;
      type: ActivityEventType;
      file: string | null;
      branch: string | null;
      message: string | null;
      metadata: string | null;
    }>;

    return rows.map((row) => ({
      ...row,
      parentUserId: row.parentUserId || null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  }

  // ============================================
  // Summary Operations
  // ============================================

  createSummary(
    orgId: string,
    teamId: string,
    periodStart: string,
    periodEnd: string,
    content: string,
    oneLiner: string,
    eventCount: number,
  ): Summary {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO summaries (id, orgId, teamId, periodStart, periodEnd, content, oneLiner, eventCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(id, orgId, teamId, periodStart, periodEnd, content, oneLiner, eventCount, createdAt);

    return { id, orgId, teamId, periodStart, periodEnd, content, oneLiner, eventCount, createdAt };
  }

  getSummaries(orgId: string, options: { since?: string; limit?: number } = {}): Summary[] {
    const { since, limit = 50 } = options;

    let query = `
      SELECT id, orgId, teamId, periodStart, periodEnd, content, oneLiner, eventCount, createdAt
      FROM summaries
      WHERE orgId = ?
    `;
    const params: (string | number)[] = [orgId];

    if (since) {
      query += ` AND createdAt > ?`;
      params.push(since);
    }

    query += ` ORDER BY createdAt DESC LIMIT ?`;
    params.push(limit);

    return this.db.prepare(query).all(...params) as Summary[];
  }

  getLatestSummaryTime(teamId: string): string | null {
    const row = this.db
      .prepare(
        `
      SELECT MAX(periodEnd) as lastEnd
      FROM summaries WHERE teamId = ?
    `,
      )
      .get(teamId) as { lastEnd: string | null } | undefined;

    return row?.lastEnd || null;
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let instance: Persistence | null = null;

export function getPersistence(dbPath?: string): Persistence {
  if (!instance) {
    instance = new Persistence(dbPath);
  }
  return instance;
}

export function resetPersistence(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
