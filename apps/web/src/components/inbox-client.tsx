"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import { formatDate, shorten } from "@/lib/format";
import { list, normaliseCase, number, record } from "@/lib/normalise";
import type { CaseSummary, UnknownRecord } from "@/lib/types";
import { ErrorState, EmptyState, LoadingState, StatusPill } from "@/components/ui";

type DashboardData = { counts?: UnknownRecord };

function countFrom(counts: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = counts[key];
    if (typeof value === "number") return number(value);
  }
  return null;
}

function CountCard({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <article className="count-card">
      <p>{label}</p>
      <strong>{value === null ? "—" : value}</strong>
      <span>{note}</span>
    </article>
  );
}

export function InboxClient() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState("");
  const [newRequestError, setNewRequestError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (sourceType !== "all") params.set("sourceType", sourceType);
      if (stateFilter !== "all") params.set("scope", stateFilter);
      const suffix = params.size ? `?${params.toString()}` : "";
      const [dashboardResponse, casesResponse] = await Promise.all([
        api<unknown>("/api/dashboard"),
        api<unknown>(`/api/cases${suffix}`)
      ]);
      const dashboardSource = record(dashboardResponse);
      const caseSource = record(casesResponse);
      setDashboard({ counts: record(dashboardSource.counts ?? dashboardSource) });
      setCases(list(caseSource.items ?? casesResponse).map(normaliseCase));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, sourceType, stateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = newRequest.trim();
    if (!text) {
      setNewRequestError("Describe the request before creating it.");
      return;
    }
    if (text.length > 4000) {
      setNewRequestError("A new request can contain up to 4,000 characters.");
      return;
    }
    setCreating(true);
    setNewRequestError("");
    try {
      const response = await api<unknown>("/api/cases", { method: "POST", body: JSON.stringify({ text }) });
      const source = record(response);
      const created = normaliseCase(source.case ?? response);
      if (!created.id) throw new Error("The service did not return a new case.");
      router.push(`/cases/${created.id}`);
    } catch (caught) {
      setNewRequestError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  }

  const counts = dashboard.counts ?? {};
  const onApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search);
  };

  return (
    <div className="page-stack inbox-page">
      <section className="count-grid" aria-label="Workspace counts">
        <CountCard label="Source requests" value={countFrom(counts, ["sourceRequests", "sourceRequestCount", "requests", "source_requests"])} note="Imported employee records" />
        <CountCard label="Active source tickets" value={countFrom(counts, ["activeSourceTickets", "activeTickets", "active_source_tickets"])} note="Existing queue records" />
        <CountCard label="Closed history" value={countFrom(counts, ["closedHistoricalTickets", "closedHistoryTickets", "closed_historical_tickets"])} note="Read-only source records" />
        <CountCard label="Processed" value={countFrom(counts, ["processedCases", "processed", "processed_cases"])} note="Current workspace state" />
        <CountCard label="Pending" value={countFrom(counts, ["pendingCases", "pending", "pending_cases"])} note="Actionable workspace state" />
      </section>

      <section className="panel inbox-panel" aria-labelledby="inbox-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">All source and local records</p>
            <h2 id="inbox-heading">Inbox</h2>
          </div>
          <button className="button button-primary" type="button" onClick={() => setNewRequestOpen((open) => !open)} aria-expanded={newRequestOpen}>
            {newRequestOpen ? "Close form" : "New request"}
          </button>
        </div>

        {newRequestOpen ? (
          <form className="new-request-form" onSubmit={createRequest}>
            <label htmlFor="new-request-text">Describe the request</label>
            <textarea id="new-request-text" maxLength={4000} value={newRequest} onChange={(event) => setNewRequest(event.target.value)} placeholder="Add a request for the same policy-grounded workflow." />
            <div className="form-footer">
              <span>{newRequest.length.toLocaleString()} / 4,000</span>
              <div>
                <button className="button button-secondary" type="button" onClick={() => { setNewRequestOpen(false); setNewRequestError(""); }}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={creating}>{creating ? "Creating…" : "Create request"}</button>
              </div>
            </div>
            {newRequestError ? <p className="form-alert" role="alert">{newRequestError}</p> : null}
          </form>
        ) : null}

        <form className="filters" onSubmit={onApplyFilters}>
          <label className="search-field" htmlFor="case-search">
            <span>Search cases</span>
            <input id="case-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, employee, or request text" />
          </label>
          <label>
            <span>Source type</span>
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              <option value="all">All records</option>
              <option value="request">Requests</option>
              <option value="ticket">Source tickets</option>
              <option value="custom">Local requests</option>
            </select>
          </label>
          <label>
            <span>Current state</span>
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="all">All states</option>
              <option value="actionable">Actionable</option>
              <option value="history">Historical</option>
            </select>
          </label>
          <button className="button button-secondary filter-submit" type="submit">Apply</button>
        </form>

        {loading ? <LoadingState label="Loading case records…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && cases.length === 0 ? <EmptyState title="No records match these filters">Try clearing a filter or create a new request.</EmptyState> : null}
        {!loading && !error && cases.length > 0 ? (
          <div className="case-table-wrap">
            <table className="case-table">
              <thead>
                <tr><th scope="col">Source</th><th scope="col">Request</th><th scope="col">Employee</th><th scope="col">Source date</th><th scope="col">Current status</th></tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => (
                  <tr key={caseItem.id}>
                    <td><Link className="source-link" href={`/cases/${caseItem.id}`}>{caseItem.sourceId}</Link><span className="subtle-label">{caseItem.sourceKind}</span></td>
                    <td><Link className="case-summary-link" href={`/cases/${caseItem.id}`}>{shorten(caseItem.originalText, 120)}</Link></td>
                    <td>{caseItem.employeeName ?? "Not provided"}</td>
                    <td>{formatDate(caseItem.sourceDate)}</td>
                    <td><StatusPill value={caseItem.workState} /><span className="source-status-text">{caseItem.sourceStatus ?? "Source status not provided"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
