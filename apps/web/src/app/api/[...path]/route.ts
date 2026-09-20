import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const apiOrigin = process.env.API_INTERNAL_ORIGIN?.replace(/\/$/, "");

  if (!apiOrigin) {
    return Response.json(
      { error: { code: "API_PROXY_UNAVAILABLE", message: "The service proxy is not configured." } },
      { status: 503 }
    );
  }

  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, apiOrigin);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  try {
    const isBodyless = request.method === "GET" || request.method === "HEAD";
    const body = isBodyless ? undefined : await request.arrayBuffer();
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual"
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("connection");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch {
    return Response.json(
      { error: { code: "API_UNREACHABLE", message: "The backend service is temporarily unavailable." } },
      { status: 503 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
