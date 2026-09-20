"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { list, normalisePolicy, record } from "@/lib/normalise";
import type { Policy } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";

export function KnowledgeClient() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const suffix = appliedSearch.trim() ? `?search=${encodeURIComponent(appliedSearch.trim())}` : "";
      const response = await api<unknown>(`/api/policies${suffix}`);
      const source = record(response);
      setPolicies(list(source.items ?? response).map(normalisePolicy));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => { void load(); }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search);
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="knowledge-heading">
        <div className="panel-heading">
          <div><p className="eyebrow">Immutable source-grounded passages</p><h2 id="knowledge-heading">Knowledge</h2></div>
          <p className="panel-note">Search uses the local PostgreSQL policy corpus.</p>
        </div>
        <form className="knowledge-search" onSubmit={submitSearch}>
          <label htmlFor="policy-search">Search policy text</label>
          <div><input id="policy-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or passage" /><button className="button button-secondary" type="submit">Search</button></div>
        </form>
        {loading ? <LoadingState label="Loading policy passages…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && policies.length === 0 ? <EmptyState title="No policy passages match">Try a shorter phrase or clear the search.</EmptyState> : null}
        {!loading && !error && policies.length ? <div className="policy-grid">{policies.map((policy) => (
          <article className="policy-card" id={`policy-${policy.id}`} key={policy.id}>
            <div className="policy-card-header"><span className="source-card-id">{policy.id}</span><span>{policy.authority ?? "Policy"}</span></div>
            <h3>{policy.title}</h3>
            <p>{policy.text}</p>
            <dl className="policy-meta"><div><dt>Source</dt><dd>{policy.sourceFile ?? "Source file not recorded"}</dd></div><div><dt>Reference</dt><dd>{policy.page ? `Page ${policy.page}` : "Page not recorded"}{policy.section ? ` · ${policy.section}` : ""}</dd></div>{policy.issuer ? <div><dt>Issuer</dt><dd>{policy.issuer}</dd></div> : null}</dl>
            {policy.relatedConflictIds?.length && policy.relatedConflictIds.filter((id) => id !== policy.id).length ? <p className="policy-conflict">Conflict reference: {policy.relatedConflictIds.filter((id) => id !== policy.id).map((id, index) => <span key={id}>{index ? ", " : ""}<Link href={`#policy-${id}`}>{id}</Link></span>)}</p> : null}
          </article>
        ))}</div> : null}
      </section>
    </div>
  );
}
