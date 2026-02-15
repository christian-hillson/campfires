import type { Request } from 'express';

type AuditEventType = 'auth_failure' | 'auth_success' | 'authorization_denied' | 'rate_limit_hit';

interface AuditEntry {
  timestamp: string;
  event: AuditEventType;
  ip: string;
  method: string;
  path: string;
  userId?: string;
  detail?: string;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

function emit(entry: AuditEntry): void {
  console.log(JSON.stringify(entry));
}

export function auditAuthFailure(req: Request, detail: string): void {
  emit({
    timestamp: new Date().toISOString(),
    event: 'auth_failure',
    ip: getClientIp(req),
    method: req.method,
    path: req.originalUrl,
    detail,
  });
}

export function auditAuthSuccess(req: Request, userId: string): void {
  emit({
    timestamp: new Date().toISOString(),
    event: 'auth_success',
    ip: getClientIp(req),
    method: req.method,
    path: req.originalUrl,
    userId,
  });
}

export function auditAuthorizationDenied(req: Request, userId: string, detail: string): void {
  emit({
    timestamp: new Date().toISOString(),
    event: 'authorization_denied',
    ip: getClientIp(req),
    method: req.method,
    path: req.originalUrl,
    userId,
    detail,
  });
}

export function auditRateLimitHit(req: Request): void {
  emit({
    timestamp: new Date().toISOString(),
    event: 'rate_limit_hit',
    ip: getClientIp(req),
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.userId,
  });
}
