"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import { labelFor } from "@/lib/format";
import { normaliseRuntime, normaliseUser, record } from "@/lib/normalise";
import type { RuntimeSettings, User } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui";

export function SettingsClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [runtime, setRuntime] = useState<RuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, settings] = await Promise.all([api<unknown>("/api/auth/me"), api<unknown>("/api/settings/runtime")]);
      const meSource = record(me);
      setUser(normaliseUser(meSource.user ?? me));
      setRuntime(normaliseRuntime(settings));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading) return <LoadingState label="Loading workspace settings…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="settings-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Authenticated workspace</p><h2>Account</h2></div></div><dl className="settings-list"><div><dt>Display name</dt><dd>{user?.displayName ?? "Not available"}</dd></div><div><dt>Email</dt><dd>{user?.email ?? "Not available"}</dd></div><div><dt>Workspace</dt><dd>{user?.workspaceName ?? "Assessment sandbox"}</dd></div></dl></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Read-only server configuration</p><h2>Runtime</h2></div></div><dl className="settings-list"><div><dt>Agent mode</dt><dd>{runtime?.agentMode ?? runtime?.mode ? labelFor(runtime.agentMode ?? runtime.mode) : "Not available"}</dd></div><div><dt>Configured model</dt><dd>{runtime?.model ?? "Not available"}</dd></div><div><dt>Source version</dt><dd>{runtime?.sourceVersion ?? "Assessment dataset · Sep 2026"}</dd></div></dl><p className="settings-note">API keys are configured only in the ignored server environment file. They are never entered or stored in this browser.</p></section>
      <section className="panel settings-wide"><div className="panel-heading"><div><p className="eyebrow">Scope and attribution</p><h2>About this sandbox</h2></div></div><div className="about-copy"><p>Veridian Service Desk is an assessment sandbox based on fictional source records. It records local guidance, evidence and handoffs only.</p><p>It does not send email, change accounts, fulfil hardware, approve requests, or perform external actions.</p><p>Designed and implemented for the AIONOS Assignment 2 assessment by Ansh Kapoor.</p></div><button className="button button-secondary" type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</button></section>
    </div>
  );
}
