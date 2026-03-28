import { Router, Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { CONFIG, type ActivityEventType } from '@campfires/shared';
import { getPersistence } from './persistence.js';
import { getTeamAwareness } from './ws-server.js';
import {
  signup,
  login,
  refreshToken,
  authMiddleware,
  optionalAuthMiddleware,
  generateToken,
  verifyToken,
  createWsToken,
} from './auth.js';
import {
  auditAuthFailure,
  auditAuthSuccess,
  auditAuthorizationDenied,
  auditRateLimitHit,
} from './audit-log.js';

/** Extract the authenticated user from the request (guaranteed by authMiddleware). */
function getUser(req: Request) {
  const user = req.user;
  if (!user) throw new Error('authMiddleware did not attach user');
  return user;
}

// ============================================
// Zod Schemas
// ============================================

// Strip control characters (except newline/tab) from fields that flow into AI prompts
function stripControlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Sanitized string for AI-facing fields: length limit + control char stripping
const aiSafeString = (maxLen: number) => z.string().max(maxLen).transform(stripControlChars);

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).trim(),
});

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  mission: aiSafeString(2000).optional(),
  roadmap: aiSafeString(2000).optional(),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  mission: aiSafeString(2000).optional(),
  roadmap: aiSafeString(2000).optional(),
});

const CreateTeamSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200).trim(),
  description: aiSafeString(2000).optional(),
});

const JoinTeamSchema = z.object({
  inviteCode: z.string().min(1).max(20),
});

const RegisterAgentSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
});

const ACTIVITY_TYPES = [
  'file_open',
  'file_save',
  'commit',
  'branch_switch',
  'session_start',
  'session_end',
] as const;

const AgentActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  file: z.string().max(500).optional(),
  branch: z.string().max(200).optional(),
  message: z.string().max(1000).optional(),
  metadata: z
    .record(z.string().max(100), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .refine((val) => !val || Object.keys(val).length <= 20, {
      message: 'metadata must have at most 20 keys',
    }),
});

// Session schemas
const SessionStartSchema = z.object({
  session_id: z.string().min(1).max(200),
  repo: z.string().max(500).optional(),
  branch: z.string().max(200).optional(),
});

const SessionHeartbeatSchema = z.object({
  session_id: z.string().min(1).max(200),
});

const SessionEndSchema = z.object({
  session_id: z.string().min(1).max(200),
  reason: z.string().max(500).optional(),
});

const TranscriptDeltaSchema = z.object({
  session_id: z.string().min(1).max(200),
  offset: z.number().optional(),
  delta: z.string().max(CONFIG.TRANSCRIPT_DELTA_MAX_SIZE),
  is_final: z.boolean().optional(),
  timestamp: z.string().max(50).optional(),
});

const ActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  file: z.string().max(500).optional(),
  branch: z.string().max(200).optional(),
  message: z.string().max(1000).optional(),
  metadata: z
    .record(z.string().max(100), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .refine((val) => !val || Object.keys(val).length <= 20, {
      message: 'metadata must have at most 20 keys',
    }),
  session_id: z.string().max(200).optional(),
});

// SSE clients for org-level events (team_registered, etc.)
const sseClients = new Map<string, Set<Response>>(); // orgId → Set<Response>

function broadcastOrgEvent(orgId: string, event: Record<string, unknown>): void {
  const clients = sseClients.get(orgId);
  if (!clients) return;
  const data = JSON.stringify(event);
  for (const res of clients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

export function createRouter(): Router {
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: CONFIG.AUTH_RATE_LIMIT_WINDOW_MS,
    max: CONFIG.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? '127.0.0.1'),
    message: { error: 'Too many attempts, please try again later' },
    handler: (req, res) => {
      auditRateLimitHit(req);
      res.status(429).json({ error: 'Too many attempts, please try again later' });
    },
  });

  // Tiered rate limiter: authenticated users get higher limits
  const apiLimiter = rateLimit({
    windowMs: CONFIG.API_RATE_LIMIT_WINDOW_MS,
    max: (req: Request) => {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        if (payload) return CONFIG.API_RATE_LIMIT_AUTHENTICATED;
      }
      return CONFIG.API_RATE_LIMIT_UNAUTHENTICATED;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    handler: (req, res) => {
      auditRateLimitHit(req);
      res.status(429).json({ error: 'Too many requests, please try again later' });
    },
    keyGenerator: (req: Request) => {
      // Use userId for authenticated, IP for anonymous
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        if (payload) return `user:${payload.userId}`;
      }
      return ipKeyGenerator(req.ip ?? '127.0.0.1');
    },
  });

  // Apply API rate limiter to all routes except /health
  router.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/health') return next();
    apiLimiter(req, _res, next);
  });

  // ============================================
  // Health Check
  // ============================================

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });

  // ============================================
  // Auth Endpoints
  // ============================================

  router.post('/auth/signup', authLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = SignupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const { email, password, displayName } = parsed.data;
      const result = await signup(email, password, displayName);

      if ('error' in result) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json(result);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid email or password' });
        return;
      }

      const { email, password } = parsed.data;
      const result = await login(email, password);

      if ('error' in result) {
        auditAuthFailure(req, 'Invalid credentials');
        res.status(401).json({ error: result.error });
        return;
      }

      auditAuthSuccess(req, result.user.userId);
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/auth/refresh', authLimiter, (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.slice(7);
    const result = refreshToken(token);

    if ('error' in result) {
      res.status(401).json({ error: result.error });
      return;
    }

    res.json(result);
  });

  router.post('/auth/ws-token', authMiddleware, (req: Request, res: Response) => {
    const wsToken = createWsToken(getUser(req));
    res.json({ token: wsToken, expiresIn: 30 });
  });

  // ============================================
  // Org Endpoints
  // ============================================

  router.post('/orgs', authMiddleware, (req: Request, res: Response) => {
    const parsed = CreateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    try {
      const { name, mission, roadmap } = parsed.data;
      const db = getPersistence();
      const org = db.createOrg(name, mission || '', roadmap || '');

      res.status(201).json(org);
    } catch {
      res.status(500).json({ error: 'Failed to create organization' });
    }
  });

  router.get('/orgs/:id', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getPersistence();

    const org = db.getOrg(id);
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    res.json(org);
  });

  router.put('/orgs/:id', authMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = UpdateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const updates = parsed.data;

    // Only members of this org can update it
    if (getUser(req).orgId !== id) {
      auditAuthorizationDenied(req, getUser(req).userId, 'Org update denied — wrong org');
      res.status(403).json({ error: 'You do not belong to this organization' });
      return;
    }

    try {
      const db = getPersistence();
      const org = db.updateOrg(id, updates);

      if (!org) {
        res.status(404).json({ error: 'Org not found' });
        return;
      }

      res.json(org);
    } catch {
      res.status(500).json({ error: 'Failed to update organization' });
    }
  });

  router.get('/orgs/:id/teams', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getPersistence();

    const org = db.getOrg(id);
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const teams = db.getTeamsByOrg(id);

    // Auto-layout migration: persist positions for teams that lack them
    const teamsWithoutPositions = teams.filter((t) => t.mapX == null || t.mapY == null);
    if (teamsWithoutPositions.length > 0) {
      // Simple elliptical auto-layout (matches client-side logic)
      const mapWidth = 500;
      const mapHeight = 280;
      const centerX = mapWidth / 2;
      const centerY = mapHeight / 2;
      const radiusX = mapWidth * 0.3;
      const radiusY = mapHeight * 0.25;

      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        if (team.mapX != null && team.mapY != null) continue;

        const angle = (i / teams.length) * Math.PI * 2 - Math.PI / 2;
        const x = teams.length === 1 ? centerX : centerX + Math.cos(angle) * radiusX;
        const y = teams.length === 1 ? centerY : centerY + Math.sin(angle) * radiusY;

        db.updateTeamPosition(team.teamId, x, y);
        team.mapX = x;
        team.mapY = y;
      }
    }

    // Set firstSeenAt for teams that lack it
    for (const team of teams) {
      if (!team.firstSeenAt) {
        db.setTeamFirstSeen(team.teamId);
        team.firstSeenAt = new Date().toISOString();
      }
    }

    res.json(teams);
  });

  // ============================================
  // Team Endpoints
  // ============================================

  router.post('/teams', authMiddleware, (req: Request, res: Response) => {
    const parsed = CreateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { orgId, name, description } = parsed.data;

    // Only members of this org (or users with no org yet) can create teams in it
    if (getUser(req).orgId && getUser(req).orgId !== orgId) {
      auditAuthorizationDenied(req, getUser(req).userId, 'Team create denied — wrong org');
      res.status(403).json({ error: 'You do not belong to this organization' });
      return;
    }

    const db = getPersistence();

    // Verify org exists
    const org = db.getOrg(orgId);
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const team = db.createTeam(orgId, name, description || '');

    // Calculate and persist map position for the new team
    const existingTeams = db.getTeamsByOrg(orgId);
    const mapWidth = 500;
    const mapHeight = 280;
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const radiusX = mapWidth * 0.3;
    const radiusY = mapHeight * 0.25;

    // Find gap position away from existing teams
    let bestX = centerX;
    let bestY = centerY;
    let bestMinDist = 0;
    const positioned = existingTeams.filter(
      (t) => t.mapX != null && t.mapY != null && t.teamId !== team.teamId,
    );

    if (positioned.length === 0) {
      bestX = centerX;
      bestY = centerY;
    } else {
      for (let attempt = 0; attempt < 36; attempt++) {
        const angle = (attempt / 36) * Math.PI * 2 - Math.PI / 2;
        const x = Math.max(40, Math.min(mapWidth - 40, centerX + Math.cos(angle) * radiusX));
        const y = Math.max(40, Math.min(mapHeight - 40, centerY + Math.sin(angle) * radiusY));

        let closestDist = Infinity;
        for (const pos of positioned) {
          closestDist = Math.min(closestDist, Math.hypot(x - (pos.mapX ?? 0), y - (pos.mapY ?? 0)));
        }
        if (closestDist > bestMinDist) {
          bestMinDist = closestDist;
          bestX = x;
          bestY = y;
        }
      }
    }

    db.updateTeamPosition(team.teamId, bestX, bestY);
    team.mapX = bestX;
    team.mapY = bestY;

    // Auto-join the creating user to the team
    const userId = getUser(req).userId;
    db.updateUserTeam(userId, team.teamId, orgId);

    // Emit SSE event for founder ceremony
    broadcastOrgEvent(orgId, { type: 'team_registered', team });

    res.status(201).json(team);
  });

  router.post('/teams/join', authMiddleware, (req: Request, res: Response) => {
    const parsed = JoinTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { inviteCode } = parsed.data;

    const db = getPersistence();
    const team = db.getTeamByInviteCode(inviteCode);

    if (!team) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    // Enforce org boundary: users already in an org can only join teams in the same org
    const caller = getUser(req);
    if (caller.orgId && caller.orgId !== team.orgId) {
      res.status(403).json({ error: 'You cannot join a team in a different organization' });
      return;
    }

    const userId = caller.userId;
    db.updateUserTeam(userId, team.teamId, team.orgId);

    // Get updated user
    const user = db.getUser(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate new token with updated teamId
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      teamId: user.teamId || null,
      orgId: user.orgId || null,
      type: user.type,
    });

    res.json({ team, user, token });
  });

  router.get('/teams/:id/members', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getPersistence();

    const team = db.getTeam(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const members = db.getTeamMembers(id);
    res.json(members);
  });

  router.get('/teams/:id/awareness', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getPersistence();

    const team = db.getTeam(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const states = getTeamAwareness(id);
    res.json(states);
  });

  // ============================================
  // Campfire Stories Endpoints
  // ============================================

  router.get('/orgs/:id/summaries', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const since = req.query.since as string | undefined;

    const db = getPersistence();

    const org = db.getOrg(id);
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const summaries = db.getSummaries(id, { since });
    res.json(summaries);
  });

  router.get(
    '/orgs/:id/summaries/stream',
    optionalAuthMiddleware,
    (req: Request, res: Response) => {
      const { id } = req.params;
      const db = getPersistence();

      const org = db.getOrg(id);
      if (!org) {
        res.status(404).json({ error: 'Org not found' });
        return;
      }

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Send initial summaries and active sparks
      const summaries = db.getSummaries(id, { limit: 10 });
      const sparks = db.getSparks(id, { status: 'active', limit: 10 });
      res.write(`data: ${JSON.stringify({ type: 'initial', summaries, sparks })}\n\n`);

      // Poll for new summaries and sparks
      let lastCheck = new Date().toISOString();
      let lastSparkCheck = new Date().toISOString();
      const interval = setInterval(() => {
        const newSummaries = db.getSummaries(id, { since: lastCheck });
        if (newSummaries.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'update', summaries: newSummaries })}\n\n`);
          lastCheck = new Date().toISOString();
        }

        const newSparks = db.getSparks(id, { since: lastSparkCheck });
        if (newSparks.length > 0) {
          for (const spark of newSparks) {
            res.write(`data: ${JSON.stringify({ type: 'spark', spark, isNew: true })}\n\n`);
          }
          lastSparkCheck = new Date().toISOString();
        }
      }, CONFIG.SSE_POLL_INTERVAL);

      // Send keep-alive ping
      const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
      }, CONFIG.SSE_PING_INTERVAL);

      // Register this client for org-level broadcasts
      if (!sseClients.has(id)) sseClients.set(id, new Set());
      const clients = sseClients.get(id);
      if (clients) clients.add(res);

      // Clean up on close
      req.on('close', () => {
        clearInterval(interval);
        clearInterval(pingInterval);
        sseClients.get(id)?.delete(res);
      });
    },
  );

  // ============================================
  // Spark Endpoints
  // ============================================

  router.get('/orgs/:orgId/sparks', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { orgId } = req.params;
    const VALID_SPARK_STATUSES = ['active', 'dismissed', 'expired'] as const;
    const rawStatus = (req.query.status as string) || 'active';
    const status = VALID_SPARK_STATUSES.includes(rawStatus as (typeof VALID_SPARK_STATUSES)[number])
      ? (rawStatus as (typeof VALID_SPARK_STATUSES)[number])
      : 'active';
    const teamId = req.query.teamId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const db = getPersistence();
    const org = db.getOrg(orgId);
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const sparks = db.getSparks(orgId, {
      status,
      teamId,
      limit,
    });
    res.json({ sparks });
  });

  router.get('/orgs/:orgId/sparks/log', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { orgId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rawBefore = req.query.before as string | undefined;
    const before = rawBefore && !isNaN(new Date(rawBefore).getTime()) ? rawBefore : undefined;

    const db = getPersistence();
    const org = db.getOrg(orgId);
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const result = db.getSparkLog(orgId, { limit, before });
    res.json(result);
  });

  router.post('/sparks/:sparkId/dismiss', authMiddleware, (req: Request, res: Response) => {
    const { sparkId } = req.params;
    const caller = getUser(req);

    try {
      const db = getPersistence();
      db.dismissSpark(sparkId, caller.userId);
      res.json({ status: 'ok' });
    } catch {
      res.status(500).json({ error: 'Failed to dismiss spark' });
    }
  });

  router.post('/sparks/:sparkId/view', authMiddleware, (req: Request, res: Response) => {
    const { sparkId } = req.params;
    const teamId = req.body?.teamId;
    const caller = getUser(req);

    if (!teamId) {
      res.status(400).json({ error: 'teamId required' });
      return;
    }

    try {
      const db = getPersistence();
      db.markViewedSpark(sparkId, teamId, caller.userId);
      res.json({ status: 'ok' });
    } catch {
      res.status(500).json({ error: 'Failed to mark spark as viewed' });
    }
  });

  // ============================================
  // Agent Endpoints
  // ============================================

  router.post('/agents', authMiddleware, (req: Request, res: Response) => {
    const caller = getUser(req);

    // Only human users on a team can register agents
    if (caller.type !== 'human') {
      auditAuthorizationDenied(req, caller.userId, 'Agent register denied — not human');
      res.status(403).json({ error: 'Only human users can register agents' });
      return;
    }

    if (!caller.teamId || !caller.orgId) {
      res.status(400).json({ error: 'You must be on a team to register an agent' });
      return;
    }

    const parsed = RegisterAgentSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { displayName } = parsed.data;

    try {
      const db = getPersistence();
      const parentUser = db.getUser(caller.userId);
      const agentName = displayName || `${parentUser?.displayName || caller.email}'s Claude`;

      const agent = db.createAgentUser(caller.userId, agentName, caller.teamId, caller.orgId);

      // Generate a JWT for the agent
      const agentToken = generateToken({
        userId: agent.userId,
        email: agent.email,
        teamId: agent.teamId || null,
        orgId: agent.orgId || null,
        type: 'agent',
      });

      res.status(201).json({ agent, token: agentToken });
    } catch {
      res.status(500).json({ error: 'Failed to register agent' });
    }
  });

  router.post('/agents/activity', authMiddleware, (req: Request, res: Response) => {
    const caller = getUser(req);
    const parsed = AgentActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const body = parsed.data;

    if (!caller.teamId) {
      res.status(400).json({ error: 'Agent must be on a team' });
      return;
    }

    try {
      const db = getPersistence();

      // Look up the agent user to get parentUserId
      const agentUser = db.getUser(caller.userId);
      const parentUserId = agentUser?.parentUserId || null;

      const event = db.appendActivityEvent({
        userId: caller.userId,
        userType: caller.type,
        parentUserId,
        teamId: caller.teamId,
        type: body.type,
        file: body.file || null,
        branch: body.branch || null,
        message: body.message || null,
        metadata: body.metadata || null,
        sessionId: null,
      });

      res.status(201).json(event);
    } catch {
      res.status(500).json({ error: 'Failed to record agent activity' });
    }
  });

  // ============================================
  // Session Endpoints (Claude Code Plugin)
  // ============================================

  router.post('/sessions/start', authMiddleware, (req: Request, res: Response) => {
    const parsed = SessionStartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const caller = getUser(req);
    if (!caller.teamId) {
      res.status(400).json({ error: 'You must be on a team to start a session' });
      return;
    }

    const { session_id, repo, branch } = parsed.data;
    const db = getPersistence();

    // Idempotent: return 200 if session already exists
    const existing = db.getSession(session_id);
    if (existing) {
      res.json(existing);
      return;
    }

    const session = db.createSession(
      session_id,
      caller.userId,
      caller.teamId,
      repo || null,
      branch || null,
    );

    // Log session_start activity
    db.appendActivityEvent({
      userId: caller.userId,
      userType: caller.type,
      parentUserId: null,
      teamId: caller.teamId,
      type: 'session_start' as ActivityEventType,
      file: null,
      branch: branch || null,
      message: repo ? `Started session in ${repo}` : 'Started session',
      metadata: { sessionId: session_id },
      sessionId: session_id,
    });

    res.status(201).json(session);
  });

  router.post('/sessions/heartbeat', authMiddleware, (req: Request, res: Response) => {
    const parsed = SessionHeartbeatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const caller = getUser(req);
    const db = getPersistence();

    // Verify session ownership
    const session = db.getSession(parsed.data.session_id);
    if (!session || session.isComplete) {
      res.status(404).json({ error: 'Session not found or already ended' });
      return;
    }
    if (session.userId !== caller.userId) {
      auditAuthorizationDenied(req, caller.userId, 'Session heartbeat denied — not owner');
      res.status(403).json({ error: 'Not your session' });
      return;
    }

    db.updateSessionHeartbeat(parsed.data.session_id);
    res.json({ status: 'ok' });
  });

  router.post('/sessions/end', authMiddleware, (req: Request, res: Response) => {
    const parsed = SessionEndSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const caller = getUser(req);
    const { session_id, reason } = parsed.data;
    const db = getPersistence();

    // Verify session ownership
    const session = db.getSession(session_id);
    if (!session || session.isComplete) {
      res.status(404).json({ error: 'Session not found or already ended' });
      return;
    }
    if (session.userId !== caller.userId) {
      auditAuthorizationDenied(req, caller.userId, 'Session end denied — not owner');
      res.status(403).json({ error: 'Not your session' });
      return;
    }

    db.endSession(session_id);

    // Log session_end activity
    if (caller.teamId) {
      db.appendActivityEvent({
        userId: caller.userId,
        userType: caller.type,
        parentUserId: null,
        teamId: caller.teamId,
        type: 'session_end' as ActivityEventType,
        file: null,
        branch: null,
        message: reason || 'Session ended',
        metadata: { sessionId: session_id },
        sessionId: session_id,
      });
    }

    res.json({ status: 'ok' });
  });

  router.post('/sessions/transcript-delta', authMiddleware, (req: Request, res: Response) => {
    const parsed = TranscriptDeltaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const caller = getUser(req);
    const { session_id, delta, is_final } = parsed.data;
    const db = getPersistence();

    // Verify session ownership
    const session = db.getSession(session_id);
    if (!session || session.isComplete) {
      res.status(404).json({ error: 'Session not found or already ended' });
      return;
    }
    if (session.userId !== caller.userId) {
      auditAuthorizationDenied(req, caller.userId, 'Transcript delta denied — not owner');
      res.status(403).json({ error: 'Not your session' });
      return;
    }

    db.appendTranscriptDelta(session_id, delta);

    // If this is the final delta, end the session
    if (is_final) {
      db.endSession(session_id);
    }

    res.json({ status: 'ok' });
  });

  router.post('/activity', authMiddleware, (req: Request, res: Response) => {
    const caller = getUser(req);
    const parsed = ActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const body = parsed.data;

    if (!caller.teamId) {
      res.status(400).json({ error: 'You must be on a team to log activity' });
      return;
    }

    const db = getPersistence();

    // Look up user to get parentUserId
    const user = db.getUser(caller.userId);
    const parentUserId = user?.parentUserId || null;

    const event = db.appendActivityEvent({
      userId: caller.userId,
      userType: caller.type,
      parentUserId,
      teamId: caller.teamId,
      type: body.type,
      file: body.file || null,
      branch: body.branch || null,
      message: body.message || null,
      metadata: body.metadata || null,
      sessionId: body.session_id || null,
    });

    res.status(201).json(event);
  });

  // ============================================
  // Campfire Stories Endpoints (continued)
  // ============================================

  router.get('/teams/:id/activity', optionalAuthMiddleware, (req: Request, res: Response) => {
    const { id } = req.params;
    const since = req.query.since as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const db = getPersistence();

    const team = db.getTeam(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // For Campfire Stories detail view: filter to commits and branch switches for non-team members
    const isTeamMember = req.user?.teamId === id;

    const events = db.getActivityEvents(id, {
      since,
      limit,
      types: isTeamMember ? undefined : ['commit', 'branch_switch'],
    });

    res.json(events);
  });

  return router;
}

// Default router instance for production use
export const router = createRouter();
