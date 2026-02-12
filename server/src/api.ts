import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { CONFIG } from '@campfires/shared';
import { getPersistence } from './persistence.js';
import { getTeamAwareness } from './ws-server.js';
import {
  signup,
  login,
  refreshToken,
  authMiddleware,
  optionalAuthMiddleware,
  generateToken,
} from './auth.js';

// ============================================
// Zod Schemas
// ============================================

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
  mission: z.string().max(2000).optional(),
  roadmap: z.string().max(10000).optional(),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  mission: z.string().max(2000).optional(),
  roadmap: z.string().max(10000).optional(),
});

const CreateTeamSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
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
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function createRouter(): Router {
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: CONFIG.AUTH_RATE_LIMIT_WINDOW_MS,
    max: CONFIG.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
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
        res.status(401).json({ error: result.error });
        return;
      }

      res.json(result);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/auth/refresh', (req: Request, res: Response) => {
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

  // ============================================
  // Org Endpoints
  // ============================================

  router.post('/orgs', authMiddleware, (req: Request, res: Response) => {
    const parsed = CreateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { name, mission, roadmap } = parsed.data;
    const db = getPersistence();
    const org = db.createOrg(name, mission || '', roadmap || '');

    res.status(201).json(org);
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
    if (req.user!.orgId !== id) {
      res.status(403).json({ error: 'You do not belong to this organization' });
      return;
    }

    const db = getPersistence();
    const org = db.updateOrg(id, updates);

    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    res.json(org);
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
    if (req.user!.orgId && req.user!.orgId !== orgId) {
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

    // Auto-join the creating user to the team
    const userId = req.user!.userId;
    db.updateUserTeam(userId, team.teamId, orgId);

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

    const userId = req.user!.userId;
    db.updateUserTeam(userId, team.teamId, team.orgId);

    // Get updated user
    const user = db.getUser(userId);

    // Generate new token with updated teamId
    const token = generateToken({
      userId: user!.userId,
      email: user!.email,
      teamId: user!.teamId || null,
      orgId: user!.orgId || null,
      type: user!.type,
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
  // Reel Endpoints
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

      // Send initial summaries
      const summaries = db.getSummaries(id, { limit: 10 });
      res.write(`data: ${JSON.stringify({ type: 'initial', summaries })}\n\n`);

      // Poll for new summaries
      let lastCheck = new Date().toISOString();
      const interval = setInterval(() => {
        const newSummaries = db.getSummaries(id, { since: lastCheck });
        if (newSummaries.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'update', summaries: newSummaries })}\n\n`);
          lastCheck = new Date().toISOString();
        }
      }, CONFIG.SSE_POLL_INTERVAL);

      // Send keep-alive ping
      const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
      }, CONFIG.SSE_PING_INTERVAL);

      // Clean up on close
      req.on('close', () => {
        clearInterval(interval);
        clearInterval(pingInterval);
      });
    },
  );

  // ============================================
  // Agent Endpoints
  // ============================================

  router.post('/agents', authMiddleware, (req: Request, res: Response) => {
    const caller = req.user!;

    // Only human users on a team can register agents
    if (caller.type !== 'human') {
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
  });

  router.post('/agents/activity', authMiddleware, (req: Request, res: Response) => {
    const caller = req.user!;
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
    });

    res.status(201).json(event);
  });

  // ============================================
  // Reel Endpoints (continued)
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

    // For Reel detail view: filter to commits and branch switches for non-team members
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
