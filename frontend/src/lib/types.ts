export type UnknownRecord = Record<string, unknown>;

export type User = {
  id: string;
  displayName: string;
  email: string;
  workspaceName?: string;
};

export type RuntimeSettings = {
  agentMode?: string;
  model?: string;
  sourceVersion?: string;
  mode?: string;
};

export type CaseSummary = {
  id: string;
  sourceId: string;
  sourceKind: string;
  employeeName?: string | null;
  employeeEmail?: string | null;
  sourceDate?: string | null;
  sourceStatus?: string | null;
  originalText: string;
  workState: string;
  active: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "source" | string;
  content: string;
  createdAt?: string;
  metadata?: UnknownRecord;
};

export type Policy = {
  id: string;
  title: string;
  text: string;
  sourceFile?: string;
  page?: number | null;
  section?: string;
  authority?: string;
  issuer?: string | null;
  lastUpdated?: string | null;
  relatedConflictIds?: string[];
};

export type ServiceTicket = {
  id: string;
  displayId: string;
  caseId?: string;
  sourceId?: string;
  route?: string | null;
  state: string;
  originalStatus?: string | null;
  summary: string;
  reasonCode?: string | null;
  policySourceIds?: string[];
  historySourceIds?: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DecisionConflict = {
  sourceIds?: string[];
  description?: string;
};

export type Decision = {
  category?: string;
  reasonCode?: string;
  disposition?: string;
  route?: string | null;
  lifecycle?: string;
  sourceIds?: string[];
  historySourceIds?: string[];
  messages?: string[];
  questions?: string[];
  conflicts?: DecisionConflict[];
  warnings?: string[];
  serviceTicketRequired?: boolean;
  externalActionExecuted?: boolean;
};

export type TraceEvent = {
  sequenceId: number;
  id?: string;
  eventType: string;
  nodeName?: string | null;
  payload?: UnknownRecord;
  occurredAt?: string;
};

export type Run = {
  id: string;
  status: string;
  agentMode?: string;
  startedAt?: string;
  finishedAt?: string | null;
  result?: UnknownRecord | null;
  safeErrorCode?: string | null;
};
