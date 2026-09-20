"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, labelFor } from "@/lib/format";
import { list, normaliseTicket, record } from "@/lib/normalise";
import type { ServiceTicket } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, StatusPill } from "@/components/ui";

export function TicketsClient() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [filter, setFilter] = useState("open");
  const [route, setRoute] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ view: filter });
      if (route !== "all") params.set("route", route);
      const response = await api<unknown>(`/api/tickets?${params.toString()}`);
      const source = record(response);
      setTickets(list(source.items ?? response).map(normaliseTicket));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [filter, route]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="tickets-heading">
        <div className="panel-heading">
          <div><p className="eyebrow">Structured local and source records</p><h2 id="tickets-heading">Tickets</h2></div>
          <p className="panel-note">Source TK IDs are historical queue records; VDS IDs are local handoffs.</p>
        </div>
        <div className="filter-tabs" aria-label="Ticket filter">
          <button className={filter === "open" ? "tab active" : "tab"} type="button" onClick={() => setFilter("open")}>Open</button>
          <button className={filter === "history" ? "tab active" : "tab"} type="button" onClick={() => setFilter("history")}>History</button>
          <label className="inline-select"><span>Queue</span><select value={route} onChange={(event) => setRoute(event.target.value)}><option value="all">All queues</option><option value="IT">IT</option><option value="SECURITY">Security</option><option value="FINANCE">Finance</option><option value="MANAGER">Manager</option><option value="IT_FINANCE">IT + Finance</option><option value="MANAGER_FINANCE">Manager + Finance</option></select></label>
        </div>
        {loading ? <LoadingState label="Loading ticket records…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && tickets.length === 0 ? <EmptyState title="No matching tickets">There are no tickets in this queue and state filter.</EmptyState> : null}
        {!loading && !error && tickets.length ? <div className="ticket-list">{tickets.map((ticket) => (
          <article className="ticket-row" key={ticket.id}>
            <div className="ticket-id"><strong>{ticket.displayId}</strong><span>{ticket.sourceId ? `Source: ${ticket.sourceId}` : "Local service handoff"}</span></div>
            <div className="ticket-description"><p>{ticket.summary}</p><span>{ticket.reasonCode ? labelFor(ticket.reasonCode) : "No reason code provided"}</span></div>
            <div><StatusPill value={ticket.state} />{ticket.route ? <span className="route-label">{labelFor(ticket.route)}</span> : null}</div>
            <div className="ticket-evidence"><span>Evidence</span><p>{ticket.policySourceIds?.length ? ticket.policySourceIds.join(", ") : "No policy IDs recorded"}</p></div>
            <div className="ticket-link">{ticket.caseId ? <Link href={`/cases/${ticket.caseId}`}>Open case</Link> : <span>Source history</span>}<time>{formatDateTime(ticket.updatedAt ?? ticket.createdAt)}</time></div>
          </article>
        ))}</div> : null}
      </section>
    </div>
  );
}
