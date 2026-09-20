"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage, makeIdempotencyKey } from "@/lib/api";
import { formatDate, formatDateTime, labelFor } from "@/lib/format";
import {
  list,
  normaliseCase,
  normaliseDecision,
  normaliseMessage,
  normalisePolicy,
  normaliseRun,
  normaliseTicket,
  normaliseTraceEvent,
  record,
  stringList
} from "@/lib/normalise";
import type { CaseSummary, Decision, Message, Policy, Run, ServiceTicket, TraceEvent } from "@/lib/types";
import { ErrorState, LoadingState, StatusPill } from "@/components/ui";

type CaseDetailState = {
  caseItem: CaseSummary;
  messages: Message[];
  decision: Decision | null;
  ticket: ServiceTicket | null;
  policies: Policy[];
  run: Run | null;
};

function isTerminal(run: Run | null): boolean {
  if (!run) return true;
  return ["COMPLETED", "FAILED", "INTERRUPTED", "CONFLICTED"].includes(run.status.toUpperCase());
}

function outcomeNotice(decision: Decision | null, ticket: ServiceTicket | null): string {
  if (ticket || decision?.serviceTicketRequired) return "Local handoff created or updated.";
  if ((decision?.lifecycle ?? "").toLowerCase().includes("resolved")) return "Employee confirmed resolution.";
  return "Guidance recorded.";
}

function sourceCard(policy: Policy, compact = false) {
  return (
    <Link className={`source-card ${compact ? "source-card-compact" : ""}`} href={`/knowledge?policy=${encodeURIComponent(policy.id)}`} key={policy.id}>
      <span className="source-card-id">{policy.id}</span>
      <strong>{policy.title || "Source passage"}</strong>
      {policy.text ? <span>{policy.text}</span> : null}
      {!compact ? <small>{policy.sourceFile ?? "Source record"}{policy.page ? ` · p. ${policy.page}` : ""}</small> : null}
    </Link>
  );
}

export function CaseDetail({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<CaseDetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executionStarted, setExecutionStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [executionError, setExecutionError] = useState("");
  const [success, setSuccess] = useState("");
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState("");
  const [trace, setTrace] = useState<TraceEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api<unknown>(`/api/cases/${encodeURIComponent(caseId)}`);
      const source = record(response);
      const caseSource = source.case ?? response;
      const nextCase = normaliseCase(caseSource);
      setDetail({
        caseItem: nextCase,
        messages: list(source.messages).map(normaliseMessage),
        decision: normaliseDecision(source.decision ?? record(caseSource).lastDecision ?? record(caseSource).last_decision),
        ticket: source.ticket ? normaliseTicket(source.ticket) : null,
        policies: list(source.policies).map(normalisePolicy),
        run: normaliseRun(source.run ?? source.latestRun ?? record(caseSource).latestRun)
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!executing || !executionStarted) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - executionStarted) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [executing, executionStarted]);

  const loadTrace = useCallback(async () => {
    if (!detail?.run?.id) return;
    setTraceLoading(true);
    setTraceError("");
    try {
      const response = await api<unknown>(`/api/runs/${encodeURIComponent(detail.run.id)}/events`);
      const source = record(response);
      setTrace(list(source.items ?? response).map(normaliseTraceEvent));
    } catch (caught) {
      setTraceError(errorMessage(caught));
    } finally {
      setTraceLoading(false);
    }
  }, [detail?.run?.id]);

  async function waitForRun(key: string, initialRun: Run | null): Promise<Run | null> {
    let current = initialRun;
    for (let attempt = 0; attempt < 30 && !isTerminal(current); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const response = await api<unknown>(`/api/runs/by-key/${encodeURIComponent(key)}`);
      const source = record(response);
      current = normaliseRun(source.run ?? response);
    }
    return current;
  }

  async function execute(kind: "analysis" | "message") {
    if (!detail || !detail.caseItem.active) return;
    const message = followUp.trim();
    if (kind === "message" && !message) {
      setExecutionError("Write a follow-up before sending it.");
      return;
    }
    if (message.length > 4000) {
      setExecutionError("A follow-up can contain up to 4,000 characters.");
      return;
    }

    const key = makeIdempotencyKey();
    setExecuting(true);
    setExecutionStarted(Date.now());
    setElapsed(0);
    setExecutionError("");
    setSuccess("");
    try {
      const endpoint = kind === "analysis" ? "analyze" : "messages";
      const body = kind === "analysis"
        ? { idempotencyKey: key, expectedVersion: detail.caseItem.version }
        : { message, idempotencyKey: key };
      const response = await api<unknown>(`/api/cases/${encodeURIComponent(caseId)}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      const source = record(response);
      const initialRun = normaliseRun(source.run);
      const finishedRun = await waitForRun(key, initialRun);
      if (finishedRun && finishedRun.status.toUpperCase() !== "COMPLETED") {
        throw new Error("The run did not complete. The saved conversation has not been presented as a successful outcome.");
      }
      await load();
      const responseDecision = normaliseDecision(source.result ?? record(source.run).result);
      setSuccess(outcomeNotice(responseDecision ?? detail.decision, detail.ticket));
      if (kind === "message") setFollowUp("");
    } catch (caught) {
      setExecutionError(errorMessage(caught));
      await load();
    } finally {
      setExecuting(false);
      setExecutionStarted(null);
    }
  }

  const conflictIds = useMemo(() => {
    const ids = new Set<string>(detail?.decision?.sourceIds ?? []);
    detail?.decision?.conflicts?.forEach((conflict) => conflict.sourceIds?.forEach((id) => ids.add(id)));
    return ids;
  }, [detail?.decision]);

  if (loading) return <LoadingState label="Loading case workspace…" />;
  if (error || !detail) return <ErrorState message={error || "This case is unavailable."} onRetry={() => void load()} />;

  const { caseItem, messages, decision, ticket, policies, run } = detail;
  const historic = !caseItem.active;
  const referencedIds = decision?.sourceIds ?? [];
  const referencedPolicies = policies.filter((policy) => referencedIds.includes(policy.id));
  const hasLaptopConflict = conflictIds.has("KB-03") && conflictIds.has("ASSET-01");
  const laptopPolicies = ["KB-03", "ASSET-01"].map((id) => policies.find((policy) => policy.id === id) ?? { id, title: id === "KB-03" ? "Laptop Replacement" : "Asset Management Policy (Extract)", text: "Referenced source passage" });

  return (
    <div className="case-page">
      <div className="case-toolbar">
        <Link className="back-link" href="/inbox">← Inbox</Link>
        <div className="case-toolbar-status">
          {historic ? <span className="history-badge">History</span> : null}
          <StatusPill value={caseItem.workState} />
        </div>
      </div>

      {historic ? <section className="history-callout"><strong>Historical record — no action required.</strong><span>This source record is retained for context. Analysis and changes are unavailable.</span></section> : null}
      {run?.agentMode?.toLowerCase().includes("fallback") ? <section className="warning-callout"><strong>Offline fallback run</strong><span>The configured Gemini run did not complete; this outcome used the conservative offline path.</span></section> : null}
      {success ? <p className="success-banner" role="status">{success}</p> : null}
      {executionError ? <p className="form-alert" role="alert">{executionError}</p> : null}

      <div className="case-workspace">
        <section className="conversation-column" aria-labelledby="conversation-heading">
          <div className="case-record panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="eyebrow">Original request</p>
                <h2 id="conversation-heading">{caseItem.sourceId}</h2>
              </div>
              <span className="source-kind">{labelFor(caseItem.sourceKind)}</span>
            </div>
            <p className="original-message">{caseItem.originalText}</p>
            <dl className="metadata-grid">
              <div><dt>Employee</dt><dd>{caseItem.employeeName ?? "Not provided"}</dd></div>
              <div><dt>Source date</dt><dd>{formatDate(caseItem.sourceDate)}</dd></div>
              <div><dt>Source status</dt><dd>{caseItem.sourceStatus ?? "Not provided"}</dd></div>
              <div><dt>Current state</dt><dd><StatusPill value={caseItem.workState} /></dd></div>
            </dl>
          </div>

          <section className="panel conversation-panel" aria-labelledby="conversation-title">
            <div className="panel-heading compact-heading"><div><p className="eyebrow">Persisted conversation</p><h2 id="conversation-title">Conversation</h2></div></div>
            <div className="messages" aria-live="polite">
              {messages.length === 0 ? <p className="empty-inline">No follow-up has been recorded yet. Run analysis when you are ready.</p> : messages.map((message) => (
                <article className={`message message-${message.role}`} key={message.id}>
                  <div className="message-meta"><strong>{message.role === "user" ? "Employee follow-up" : message.role === "assistant" ? "Service desk" : "Source record"}</strong><span>{formatDateTime(message.createdAt)}</span></div>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>

            <form className="followup-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void execute("message"); }}>
              <label htmlFor="follow-up">Follow-up input</label>
              <textarea id="follow-up" value={followUp} maxLength={4000} disabled={historic || executing} onChange={(event) => setFollowUp(event.target.value)} placeholder={historic ? "Historical records are read-only." : "Add a factual follow-up for this case."} />
              <div className="form-footer">
                <span>{followUp.length.toLocaleString()} / 4,000</span>
                <div className="case-actions">
                  <button className="button button-secondary" type="button" disabled={historic || executing} onClick={() => void execute("analysis")}>{executing ? "Running…" : "Run analysis"}</button>
                  <button className="button button-primary" type="submit" disabled={historic || executing || !followUp.trim()}>{executing ? "Working…" : "Send follow-up"}</button>
                </div>
              </div>
              {executing ? <p className="run-progress" role="status">Running the recorded workflow · {elapsed}s elapsed</p> : null}
            </form>
          </section>
        </section>

        <aside className="decision-column" aria-label="Decision and evidence">
          <section className="panel decision-panel">
            <div className="panel-heading compact-heading"><div><p className="eyebrow">Current outcome</p><h2>Decision</h2></div>{decision?.disposition ? <StatusPill value={decision.disposition} /> : null}</div>
            {!decision ? <p className="empty-inline">No decision has been recorded. Analysis is manual and will not run just by opening this page.</p> : (
              <>
                <dl className="decision-facts">
                  <div><dt>Category</dt><dd>{labelFor(decision.category)}</dd></div>
                  <div><dt>Route</dt><dd>{decision.route ? labelFor(decision.route) : "No route recorded"}</dd></div>
                  <div><dt>Reason</dt><dd>{decision.reasonCode ? labelFor(decision.reasonCode) : "Not provided"}</dd></div>
                </dl>
                {decision.messages?.length ? <div className="outcome-copy">{decision.messages.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div> : null}
                {decision.questions?.length ? <div className="questions"><h3>Necessary follow-up</h3><ol>{decision.questions.map((question) => <li key={question}>{question}</li>)}</ol></div> : null}
                {decision.warnings?.length ? <div className="warnings"><h3>Conflict / warning</h3>{decision.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
              </>
            )}
          </section>

          {hasLaptopConflict ? <section className="panel conflict-panel"><div className="panel-heading compact-heading"><div><p className="eyebrow">Policy conflict</p><h2>Review both sources</h2></div></div><p>The supplied laptop passages use different refresh criteria; neither has a stated precedence.</p><div className="conflict-sources">{laptopPolicies.map((policy) => sourceCard(policy, true))}</div></section> : null}

          <section className="panel evidence-panel">
            <div className="panel-heading compact-heading"><div><p className="eyebrow">Supporting policies</p><h2>Source evidence</h2></div></div>
            {referencedIds.length === 0 ? <p className="empty-inline">No governing policy supplied.</p> : (
              <div className="source-cards">
                {referencedPolicies.length ? referencedPolicies.map((policy) => sourceCard(policy)) : referencedIds.map((id) => <Link className="source-card" href={`/knowledge?policy=${encodeURIComponent(id)}`} key={id}><span className="source-card-id">{id}</span><strong>Referenced source</strong><span>Open the knowledge record for the supplied passage.</span></Link>)}
              </div>
            )}
            {decision?.historySourceIds?.length ? <p className="history-sources">History context: {decision.historySourceIds.join(", ")}. It is separate from governing policy.</p> : null}
          </section>

          <section className="panel ticket-panel">
            <div className="panel-heading compact-heading"><div><p className="eyebrow">Local ticket / trace</p><h2>Handoff</h2></div></div>
            {ticket ? <div className="ticket-summary"><Link href={`/tickets?ticket=${encodeURIComponent(ticket.id)}`}>{ticket.displayId}</Link><p>{ticket.summary}</p><span>{ticket.route ? `${labelFor(ticket.route)} · ` : ""}{labelFor(ticket.state)}</span></div> : <p className="empty-inline">No local ticket has been created for this case.</p>}
            {run ? (
              <details className="trace-details" open={traceOpen} onToggle={(event) => { const open = event.currentTarget.open; setTraceOpen(open); if (open && trace.length === 0) void loadTrace(); }}>
                <summary aria-expanded={traceOpen}>View recorded workflow trace</summary>
                {traceLoading ? <LoadingState label="Loading actual trace events…" /> : null}
                {traceError ? <p className="field-error">{traceError}</p> : null}
                {!traceLoading && !traceError && trace.length === 0 ? <p className="empty-inline">No trace events are available for this run.</p> : null}
                {trace.length ? <ol className="trace-list">{trace.map((event) => <li key={event.id ?? `${event.sequenceId}-${event.eventType}`}><div><strong>{labelFor(event.eventType)}</strong>{event.nodeName ? <span>{labelFor(event.nodeName)}</span> : null}</div><time>{formatDateTime(event.occurredAt)}</time>{Object.keys(event.payload ?? {}).length ? <pre>{JSON.stringify(event.payload, null, 2)}</pre> : null}</li>)}</ol> : null}
              </details>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
