"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";

type AuthMode = "login" | "signup";

type AuthFormProps = { mode: AuthMode };

type Validation = {
  displayName?: string;
  email?: string;
  password?: string;
};

function validate(mode: AuthMode, displayName: string, email: string, password: string): Validation {
  const next: Validation = {};
  if (mode === "signup" && displayName.trim().length < 2) {
    next.displayName = "Please enter the name you would like shown in this workspace.";
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    next.email = "Enter a valid email address.";
  }
  if (mode === "signup" && password.length < 12) {
    next.password = "Use at least 12 characters for your password.";
  }
  if (mode === "login" && password.length === 0) {
    next.password = "Enter your password.";
  }
  return next;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const displayNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Validation>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create your private workspace" : "Sign in to your workspace";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate(mode, displayName, email, password);
    setErrors(validation);
    setSubmitError("");
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await api(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        body: JSON.stringify(isSignup ? { displayName: displayName.trim(), email: email.trim(), password } : { email: email.trim(), password })
      });
      router.replace("/inbox");
      router.refresh();
    } catch (error) {
      setSubmitError(errorMessage(error, "We could not sign you in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="wordmark">Veridian</p>
        <p className="auth-kicker">Service Desk</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">Private assessment sandbox</p>

        <div className="auth-switch" aria-label="Authentication mode">
          <Link className={!isSignup ? "auth-switch-link active" : "auth-switch-link"} href="/login">Sign in</Link>
          <Link className={isSignup ? "auth-switch-link active" : "auth-switch-link"} href="/signup">Create account</Link>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {isSignup ? (
            <div className="form-field">
              <label htmlFor={displayNameId}>Display name</label>
              <input
                id={displayNameId}
                name="displayName"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={errors.displayName ? `${displayNameId}-error` : undefined}
              />
              {errors.displayName ? <p className="field-error" id={`${displayNameId}-error`}>{errors.displayName}</p> : null}
            </div>
          ) : null}

          <div className="form-field">
            <label htmlFor={emailId}>Email address</label>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
            />
            {errors.email ? <p className="field-error" id={`${emailId}-error`}>{errors.email}</p> : null}
          </div>

          <div className="form-field">
            <div className="label-row">
              <label htmlFor={passwordId}>Password</label>
              {isSignup ? <span className="field-hint">At least 12 characters</span> : null}
            </div>
            <div className="password-input">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${passwordId}-error` : undefined}
              />
              <button className="text-button password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password ? <p className="field-error" id={`${passwordId}-error`}>{errors.password}</p> : null}
          </div>

          {submitError ? <p className="form-alert" role="alert">{submitError}</p> : null}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? (isSignup ? "Creating workspace…" : "Signing in…") : (isSignup ? "Create workspace" : "Sign in")}
          </button>
        </form>
      </section>
      <p className="auth-footer">Assessment dataset · fictional Veridian Corp · 21–25 Sep 2026</p>
    </main>
  );
}
