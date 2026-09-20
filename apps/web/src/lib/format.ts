export function formatDate(value?: string | null, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options
  }).format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function labelFor(value?: string | null): string {
  if (!value) return "Not available";
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function stateTone(value?: string | null): "neutral" | "olive" | "rust" | "warning" | "critical" {
  const state = (value ?? "").toUpperCase();
  if (state.includes("CLOSED") || state.includes("RESOLVED") || state.includes("ANSWERED")) return "olive";
  if (state.includes("SECURITY") || state.includes("REJECT") || state.includes("FAILED")) return "critical";
  if (state.includes("WAIT") || state.includes("PENDING") || state.includes("INVESTIGAT")) return "warning";
  if (state.includes("RUN") || state.includes("PROCESS")) return "rust";
  return "neutral";
}

export function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
