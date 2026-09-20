import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.js';

export interface PolicySeed {
  id: string;
  title: string;
  text: string;
  sourceFile: string;
  page: number;
  section: string;
  authority: string;
  issuer: string | null;
  lastUpdated: string | null;
  relatedConflictIds: string[];
}

export interface CaseSeed {
  id: string;
  kind: 'request' | 'ticket';
  employeeName: string;
  employeeEmail: string | null;
  sourceDate: string | null;
  text: string;
  sourceStatus: string;
  workState: string;
  active: boolean;
  sourceFile: string;
  page: number | number[];
  section: string;
}

async function loadJson<T>(fileName: string): Promise<T> {
  const contents = await readFile(join(config.dataDirectory, fileName), 'utf8');
  return JSON.parse(contents) as T;
}

let policyCache: Promise<PolicySeed[]> | undefined;
let requestCache: Promise<CaseSeed[]> | undefined;
let ticketCache: Promise<CaseSeed[]> | undefined;

export function loadPolicies(): Promise<PolicySeed[]> {
  policyCache ??= loadJson<PolicySeed[]>('policies.json');
  return policyCache;
}

export function loadRequests(): Promise<CaseSeed[]> {
  requestCache ??= loadJson<CaseSeed[]>('requests.json');
  return requestCache;
}

export function loadTickets(): Promise<CaseSeed[]> {
  ticketCache ??= loadJson<CaseSeed[]>('tickets.json');
  return ticketCache;
}

export async function loadSourceCases(): Promise<CaseSeed[]> {
  return [...(await loadRequests()), ...(await loadTickets())];
}
