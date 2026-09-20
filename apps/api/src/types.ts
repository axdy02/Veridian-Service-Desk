import type { Request } from 'express';

export interface Actor {
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
}

export type AuthenticatedRequest = Request & { actor?: Actor };

export interface PublicRun {
  id: string;
  status: string;
  agentMode: string | null;
  result: unknown | null;
  safeErrorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
}
