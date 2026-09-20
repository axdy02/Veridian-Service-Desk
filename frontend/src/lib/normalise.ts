import type {
  CaseSummary,
  Decision,
  Message,
  Policy,
  Run,
  RuntimeSettings,
  ServiceTicket,
  TraceEvent,
  UnknownRecord,
  User
} from "@/lib/types";

export function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

export function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function boolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringList(value: unknown): string[] {
  return list(value).filter((entry): entry is string => typeof entry === "string");
}

export function normaliseUser(value: unknown): User {
  const source = record(value);
  const workspace = record(source.workspace);
  return {
    id: string(source.id),
    displayName: string(source.displayName ?? source.display_name ?? source.name, "Demo operator"),
    email: string(source.email),
    workspaceName: optionalString(source.workspaceName ?? workspace.name) ?? undefined
  };
}

export function normaliseRuntime(value: unknown): RuntimeSettings {
  const source = record(value);
  return {
    agentMode: optionalString(source.agentMode ?? source.agent_mode) ?? undefined,
    mode: optionalString(source.mode) ?? undefined,
    model: optionalString(source.model ?? source.modelName ?? source.model_name) ?? undefined,
    sourceVersion: optionalString(source.sourceVersion ?? source.source_version) ?? undefined
  };
}

export function normaliseCase(value: unknown): CaseSummary {
  const source = record(value);
  const snapshot = record(source.sourceSnapshot ?? source.source_snapshot);
  return {
    id: string(source.id),
    sourceId: string(source.sourceId ?? source.source_id ?? snapshot.id),
    sourceKind: string(source.sourceKind ?? source.source_kind ?? snapshot.kind, "request"),
    employeeName: optionalString(source.employeeName ?? source.employee_name ?? snapshot.employeeName),
    employeeEmail: optionalString(source.employeeEmail ?? source.employee_email ?? snapshot.employeeEmail),
    sourceDate: optionalString(source.sourceDate ?? source.source_date ?? snapshot.sourceDate),
    sourceStatus: optionalString(source.sourceStatus ?? source.source_status ?? snapshot.sourceStatus),
    originalText: string(source.originalText ?? source.original_text ?? snapshot.text),
    workState: string(source.workState ?? source.work_state ?? snapshot.workState, "NOT_STARTED"),
    active: boolean(source.active ?? snapshot.active, true),
    version: number(source.version, 0),
    createdAt: optionalString(source.createdAt ?? source.created_at) ?? undefined,
    updatedAt: optionalString(source.updatedAt ?? source.updated_at) ?? undefined
  };
}

export function normaliseMessage(value: unknown): Message {
  const source = record(value);
  return {
    id: string(source.id, `${source.role ?? "message"}-${source.createdAt ?? ""}`),
    role: string(source.role, "assistant"),
    content: string(source.content),
    createdAt: optionalString(source.createdAt ?? source.created_at) ?? undefined,
    metadata: record(source.metadata)
  };
}

export function normalisePolicy(value: unknown): Policy {
  const source = record(value);
  return {
    id: string(source.id),
    title: string(source.title),
    text: string(source.text ?? source.body),
    sourceFile: optionalString(source.sourceFile ?? source.source_file) ?? undefined,
    page: typeof source.page === "number" ? source.page : typeof source.sourcePage === "number" ? source.sourcePage : null,
    section: optionalString(source.section ?? source.sourceSection ?? source.source_section) ?? undefined,
    authority: optionalString(source.authority) ?? undefined,
    issuer: optionalString(source.issuer),
    lastUpdated: optionalString(source.lastUpdated ?? source.last_updated),
    relatedConflictIds: stringList(source.relatedConflictIds ?? source.related_conflict_ids)
  };
}

export function normaliseTicket(value: unknown): ServiceTicket {
  const source = record(value);
  const caseSource = record(source.case);
  return {
    id: string(source.id),
    displayId: string(source.displayId ?? source.display_id ?? source.id),
    caseId: optionalString(source.caseId ?? source.case_id ?? caseSource.id) ?? undefined,
    sourceId: optionalString(source.sourceId ?? source.source_id ?? caseSource.sourceId) ?? undefined,
    route: optionalString(source.route),
    state: string(source.state ?? source.workState ?? source.work_state, "OPEN"),
    originalStatus: optionalString(source.originalStatus ?? source.original_status),
    summary: string(source.summary ?? source.text),
    reasonCode: optionalString(source.reasonCode ?? source.reason_code),
    policySourceIds: stringList(source.policySourceIds ?? source.policy_source_ids),
    historySourceIds: stringList(source.historySourceIds ?? source.history_source_ids),
    active: typeof source.active === "boolean" ? source.active : undefined,
    createdAt: optionalString(source.createdAt ?? source.created_at) ?? undefined,
    updatedAt: optionalString(source.updatedAt ?? source.updated_at) ?? undefined
  };
}

export function normaliseDecision(value: unknown): Decision | null {
  if (!value || typeof value !== "object") return null;
  const source = record(value);
  return {
    category: optionalString(source.category) ?? undefined,
    reasonCode: optionalString(source.reasonCode ?? source.reason_code) ?? undefined,
    disposition: optionalString(source.disposition) ?? undefined,
    route: optionalString(source.route),
    lifecycle: optionalString(source.lifecycle) ?? undefined,
    sourceIds: stringList(source.sourceIds ?? source.source_ids),
    historySourceIds: stringList(source.historySourceIds ?? source.history_source_ids),
    messages: stringList(source.messages),
    questions: stringList(source.questions).slice(0, 2),
    conflicts: list(source.conflicts).map((conflict) => {
      const item = record(conflict);
      return { sourceIds: stringList(item.sourceIds ?? item.source_ids), description: optionalString(item.description) ?? undefined };
    }),
    warnings: stringList(source.warnings),
    serviceTicketRequired: typeof source.serviceTicketRequired === "boolean" ? source.serviceTicketRequired : undefined,
    externalActionExecuted: typeof source.externalActionExecuted === "boolean" ? source.externalActionExecuted : undefined
  };
}

export function normaliseRun(value: unknown): Run | null {
  if (!value || typeof value !== "object") return null;
  const source = record(value);
  return {
    id: string(source.id),
    status: string(source.status, "UNKNOWN"),
    agentMode: optionalString(source.agentMode ?? source.agent_mode) ?? undefined,
    startedAt: optionalString(source.startedAt ?? source.started_at) ?? undefined,
    finishedAt: optionalString(source.finishedAt ?? source.finished_at),
    result: record(source.result),
    safeErrorCode: optionalString(source.safeErrorCode ?? source.safe_error_code)
  };
}

export function normaliseTraceEvent(value: unknown): TraceEvent {
  const source = record(value);
  return {
    sequenceId: number(source.sequenceId ?? source.sequence_id),
    id: optionalString(source.id) ?? undefined,
    eventType: string(source.eventType ?? source.event_type, "EVENT"),
    nodeName: optionalString(source.nodeName ?? source.node_name),
    payload: record(source.payload),
    occurredAt: optionalString(source.occurredAt ?? source.occurred_at) ?? undefined
  };
}
