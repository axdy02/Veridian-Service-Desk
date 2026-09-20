import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { hashSessionToken, newSessionToken } from '@veridian/domain/auth';
import { config } from './config.js';
import { query } from './db.js';
import { AppError } from './errors.js';
import type { Actor, AuthenticatedRequest } from './types.js';

function cookies(request: Request): Record<string, string> {
  const header = request.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').flatMap((part) => {
      const [rawName, ...rawValue] = part.trim().split('=');
      if (!rawName || rawValue.length === 0) return [];
      try {
        return [[decodeURIComponent(rawName), decodeURIComponent(rawValue.join('='))]];
      } catch {
        return [];
      }
    })
  );
}

function cookieHeader(value: string, expires: Date, maxAgeSeconds: number): string {
  const fragments = [
    `${config.sessionCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    `Expires=${expires.toUTCString()}`
  ];
  if (config.cookieSecure) fragments.push('Secure');
  return fragments.join('; ');
}

export function setSessionCookie(response: Response, token: string, expires: Date): void {
  const maxAgeSeconds = Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000));
  response.setHeader('Set-Cookie', cookieHeader(token, expires, maxAgeSeconds));
}

export function clearSessionCookie(response: Response): void {
  response.setHeader('Set-Cookie', cookieHeader('', new Date(0), 0));
}

export async function createSession(client: PoolClient, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000);
  await client.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashSessionToken(token), userId, expiresAt]
  );
  return { token, expiresAt };
}

export async function rotateSessions(client: PoolClient, userId: string): Promise<{ token: string; expiresAt: Date }> {
  await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  return createSession(client, userId);
}

export async function authenticate(request: AuthenticatedRequest, _response: Response, next: NextFunction): Promise<void> {
  try {
    const token = cookies(request)[config.sessionCookieName];
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }
    const tokenHash = hashSessionToken(token);
    const result = await query<{
      user_id: string;
      workspace_id: string;
      email: string;
      display_name: string;
    }>(
      `SELECT s.user_id, w.id AS workspace_id, u.email, u.display_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN workspaces w ON w.owner_user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }
    request.actor = {
      userId: row.user_id,
      workspaceId: row.workspace_id,
      email: row.email,
      displayName: row.display_name
    } satisfies Actor;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireActor(request: AuthenticatedRequest): Actor {
  if (!request.actor) throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
  return request.actor;
}

export function requireSameOrigin(request: Request, _response: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    next();
    return;
  }
  const origin = request.headers.origin;
  const requestedWith = request.get('X-VDS-Request');
  const contentType = request.get('Content-Type')?.toLowerCase() ?? '';
  if (origin !== config.appOrigin || requestedWith !== '1' || !contentType.startsWith('application/json')) {
    next(new AppError(403, 'ORIGIN_REJECTED', 'This request was not accepted from the application origin.'));
    return;
  }
  next();
}

export async function revokeSession(request: Request): Promise<void> {
  const token = cookies(request)[config.sessionCookieName];
  if (token && /^[a-f0-9]{64}$/i.test(token)) {
    await query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(token)]);
  }
}

export function publicActor(actor: Actor) {
  return { id: actor.userId, email: actor.email, displayName: actor.displayName, workspace: { id: actor.workspaceId, name: 'Your workspace' } };
}

export { randomUUID };
