"use client";

import { ReactNode } from "react";
import { labelFor, stateTone } from "@/lib/format";

export function StatusPill({ value, className = "" }: { value?: string | null; className?: string }) {
  return <span className={`status-pill status-${stateTone(value)} ${className}`.trim()}>{labelFor(value)}</span>;
}

export function LoadingState({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div className="state-box" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = "This view could not be loaded"
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="state-box state-error" role="alert">
      <span className="state-symbol" aria-hidden="true">!</span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {onRetry ? <button className="button button-secondary" type="button" onClick={onRetry}>Try again</button> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="state-box state-empty">
      <span className="state-symbol" aria-hidden="true">—</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function FixedNotice() {
  return (
    <aside className="fixed-notice" aria-label="Sandbox limitation">
      <span aria-hidden="true">⌁</span>
      <span>This sandbox records local guidance and handoffs only. It does not change external accounts or send email.</span>
    </aside>
  );
}
