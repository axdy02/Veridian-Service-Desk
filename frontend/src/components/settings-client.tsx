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
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Your workspace</p><h2>Account</h2></div></div><dl className="settings-list"><div><dt>Display name</dt><dd>{user?.displayName ?? "Not available"}</dd></div><div><dt>Email</dt><dd>{user?.email ?? "Not available"}</dd></div><div><dt>Workspace</dt><dd>{user?.workspaceName ?? "Your workspace"}</dd></div></dl></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Server configuration</p><h2>Runtime</h2></div></div><dl className="settings-list"><div><dt>Agent mode</dt><dd>{runtime?.agentMode ?? runtime?.mode ? labelFor(runtime.agentMode ?? runtime.mode) : "Not available"}</dd></div><div><dt>Configured model</dt><dd>{runtime?.model ?? "Not available"}</dd></div><div><dt>Source version</dt><dd>{runtime?.sourceVersion ?? "Not provided"}</dd></div></dl><p className="settings-note">API keys stay in the server environment and are never entered or stored in this browser.</p></section>
      <section className="panel settings-wide"><div className="panel-heading"><div><p className="eyebrow">About</p><h2>Veridian Service Desk</h2></div></div><div className="about-copy"><p>Keep requests, policies, decisions, and ticket handoffs together in one workspace.</p><p>Veridian records guidance and evidence locally; it does not send email, change accounts, fulfil hardware, or perform external actions.</p></div><button className="button button-secondary" type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</button></section>
    </div>
  );
}
