"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api, errorMessage, isApiError } from "@/lib/api";
import { labelFor } from "@/lib/format";
import { normaliseRuntime, normaliseUser } from "@/lib/normalise";
import type { RuntimeSettings, User } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui";

type WorkspaceShellProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

const navigation = [
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/tickets", label: "Tickets", icon: "ticket" },
  { href: "/knowledge", label: "Knowledge", icon: "book" },
  { href: "/audit", label: "Audit", icon: "audit" },
  { href: "/settings", label: "Settings", icon: "settings" }
] as const;

type IconName = (typeof navigation)[number]["icon"] | "chevron";

function NavigationIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    inbox: <><path d="M4 5.5h16v13H4z" /><path d="M4 14h4l2 2h4l2-2h4" /></>,
    ticket: <><path d="M5 5h14v4a2.5 2.5 0 0 0 0 5v5H5v-5a2.5 2.5 0 0 0 0-5z" /><path d="M12 8v8" /></>,
    book: <><path d="M4.5 5.5A3.5 3.5 0 0 1 8 4h4v15H8a3.5 3.5 0 0 0-3.5 1.5z" /><path d="M19.5 5.5A3.5 3.5 0 0 0 16 4h-4v15h4a3.5 3.5 0 0 1 3.5 1.5z" /></>,
    audit: <><path d="M6 3.5h12v17H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 14.8 6L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A7 7 0 0 0 9.2 18l.3 3h5l.3-3a7 7 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z" /></>,
    chevron: <path d="m9 8 4 4-4 4" />
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function modeLabel(runtime: RuntimeSettings | null): string {
  const mode = (runtime?.agentMode ?? runtime?.mode ?? "").toLowerCase();
  if (mode.includes("fallback")) return "Offline fallback";
  if (mode.includes("gemini")) return "Gemini";
  if (mode.includes("offline")) return "Offline";
  return "Mode unavailable";
}

export function WorkspaceShell({ title, children, actions }: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [runtime, setRuntime] = useState<RuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function loadSession() {
    setLoading(true);
    setError("");
    try {
      const me = await api<unknown>("/api/auth/me");
      const source = me && typeof me === "object" ? me as Record<string, unknown> : {};
      setUser(normaliseUser(source.user ?? source));
      try {
        const settings = await api<unknown>("/api/settings/runtime");
        setRuntime(normaliseRuntime(settings));
      } catch {
        setRuntime(null);
      }
    } catch (caught) {
      if (isApiError(caught) && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
    // Session must be checked on every fresh page mount; router is stable in Next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // The local cookie may already be invalid; navigating to sign-in is still safe.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading) return <main className="shell-loading"><LoadingState label="Loading your private workspace…" /></main>;
  if (error) return <main className="shell-loading"><ErrorState message={error} onRetry={() => void loadSession()} title="Your workspace is unavailable" /></main>;
  if (!user) return null;

  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">Skip to workspace content</a>
      <aside className={`sidebar ${drawerOpen ? "sidebar-open" : ""}`} aria-label="Primary navigation" id="workspace-navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">V</span>
          <div><p className="wordmark">Veridian</p><p>Service Desk</p></div>
        </div>
        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href === "/inbox" && pathname.startsWith("/cases/"));
            return (
              <Link
                className={`nav-link ${active ? "nav-link-active" : ""}`}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-marker"><NavigationIcon name={item.icon} /></span>
                <span>{item.label}</span>
                <span className="nav-chevron"><NavigationIcon name="chevron" /></span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <span className="status-pill status-neutral">Private workspace</span>
          <p>{user.workspaceName ?? "Your workspace"}</p>
        </div>
      </aside>
      {drawerOpen ? <button className="drawer-scrim" type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} /> : null}

      <div className="workspace-content">
        <header className="app-header">
          <div className="header-leading">
            <button
              className="menu-button"
              type="button"
              aria-label="Open navigation"
              aria-controls="workspace-navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((open) => !open)}
            >
              <span /> <span /> <span />
            </button>
            <div>
              <p className="eyebrow">Veridian Service Desk</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="header-actions">
            <span className={`mode-badge ${modeLabel(runtime).toLowerCase().replaceAll(" ", "-")}`}>{modeLabel(runtime)}</span>
            {actions}
            <div className="user-menu-wrap">
              <button className="user-menu-button" type="button" aria-label="Open account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                <span className="user-initial" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span>
                <span className="user-name">{user.displayName}</span>
                <span className="account-chevron"><NavigationIcon name="chevron" /></span>
              </button>
              {menuOpen ? (
                <div className="user-popover" role="menu">
                  <p>{user.email}</p>
                  <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>Workspace settings</Link>
                  <button type="button" role="menuitem" onClick={() => void logout()} disabled={loggingOut}>
                    {loggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="app-main" id="workspace-main">{children}</main>
      </div>
    </div>
  );
}

export function ModeSentence({ runtime }: { runtime: RuntimeSettings | null }) {
  return runtime?.model ? `${modeLabel(runtime)} · ${labelFor(runtime.model)}` : modeLabel(runtime);
}
