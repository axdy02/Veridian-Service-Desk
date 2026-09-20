"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, labelFor } from "@/lib/format";
import { list, normaliseTraceEvent, record } from "@/lib/normalise";
import type { TraceEvent } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";

export function AuditClient() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [caseId, setCaseId] = useState("");
  const [runId, setRunId] = useState("");
  const [appliedCaseId, setAppliedCaseId] = useState("");
  const [appliedRunId, setAppliedRunId] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor?: string, append = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (appliedCaseId.trim()) params.set("caseId", appliedCaseId.trim());
      if (appliedRunId.trim()) params.set("runId", appliedRunId.trim());
      if (cursor) params.set("cursor", cursor);
      const response = await api<unknown>(`/api/audit${params.size ? `?${params.toString()}` : ""}`);
      const source = record(response);
      const incoming = list(source.items ?? response).map(normaliseTraceEvent);
      setEvents((current) => append ? [...current, ...incoming] : incoming);
      setNextCursor(typeof source.nextCursor === "string" ? source.nextCursor : null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedCaseId, appliedRunId]);

  useEffect(() => { void load(); }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedCaseId(caseId);
    setAppliedRunId(runId);
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="audit-heading">
        <div className="panel-heading"><div><p className="eyebrow">Append-only local application events</p><h2 id="audit-heading">Audit</h2></div><p className="panel-note">Original source status and observed application transitions are shown separately.</p></div>
        <form className="audit-filters" onSubmit={applyFilters}>
          <label><span>Case ID</span><input value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="Optional case UUID" /></label>
          <label><span>Run ID</span><input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="Optional run UUID" /></label>
          <button className="button button-secondary" type="submit">Filter events</button>
        </form>
        {loading && events.length === 0 ? <LoadingState label="Loading recorded events…" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && events.length === 0 ? <EmptyState title="No audit events match">Run an analysis or clear a filter to view recorded application activity.</EmptyState> : null}
        {!error && events.length ? <ol className="audit-list">{events.map((event) => <li key={event.id ?? `${event.sequenceId}-${event.eventType}`}><div className="audit-sequence">{event.sequenceId || "—"}</div><div className="audit-event"><strong>{labelFor(event.eventType)}</strong><span>{event.nodeName ? labelFor(event.nodeName) : "Application event"}</span></div><time>{formatDateTime(event.occurredAt)}</time><details><summary>Safe payload</summary><pre>{JSON.stringify(event.payload ?? {}, null, 2)}</pre></details></li>)}</ol> : null}
        {!error && nextCursor ? <div className="load-more"><button className="button button-secondary" type="button" disabled={loading} onClick={() => void load(nextCursor, true)}>{loading ? "Loading…" : "Load more events"}</button></div> : null}
      </section>
    </div>
  );
}
