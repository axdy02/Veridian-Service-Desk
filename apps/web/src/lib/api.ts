export type ApiEnvelope<T> = { data: T };

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ApiError extends Error {
  readonly code?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    // The API checks a purpose-built header in addition to same-origin cookies.
    headers.set("x-vds-request", "1");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
  } catch {
    throw new ApiError("The service could not be reached. Check that the application is running.", 0);
  }

  const responseBody = (await response.json().catch(() => null)) as (ApiEnvelope<T> & ErrorEnvelope) | null;

  if (!response.ok) {
    const details = responseBody?.error;
    throw new ApiError(
      details?.message ?? "The request could not be completed.",
      response.status,
      details?.code,
      details?.requestId
    );
  }

  if (!responseBody || !("data" in responseBody)) {
    throw new ApiError("The service returned an unexpected response.", response.status);
  }

  return responseBody.data;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
