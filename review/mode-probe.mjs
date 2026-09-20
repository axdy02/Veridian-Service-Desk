// Minimal, secret-safe diagnostic for the configured Gemini path (finding R-01).
// Run: node review/mode-probe.mjs
// It loads the repo-root .env exactly like the API does, calls the ChatGoogle SDK once
// with a trivial prompt, and prints only error CLASSES - never the key or raw provider
// response bodies.
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: resolve(root, '.env'), override: false, quiet: true });

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

if (!apiKey) {
  console.log('NO_KEY_CONFIGURED: nothing to probe (offline mode is the correct path).');
  process.exit(0);
}

try {
  const { ChatGoogle } = await import('@langchain/google');
  const client = new ChatGoogle({ apiKey, model, maxRetries: 0 });
  const response = await client.invoke('Return the single word: ready', { signal: AbortSignal.timeout(18_000) });
  const text = typeof response?.content === 'string' ? response.content : JSON.stringify(response?.content ?? null);
  console.log(`LIVE_CALL_SUCCEEDED with model ${model}; first 40 chars of reply: ${text.slice(0, 40).replace(/\s+/g, ' ')}`);
  process.exit(0);
} catch (error) {
  const name = error?.name ?? 'Unknown';
  const message = String(error?.message ?? error);
  // Collapse anything that could carry key material or provider internals into a class.
  const cls = /401|unauthor|api key|API_KEY/i.test(message)
    ? 'AUTH/KEY_REJECTED'
    : /404|not found|model/i.test(message)
      ? 'MODEL_NOT_FOUND_OR_UNAVAILABLE'
      : /429|quota|rate/i.test(message)
        ? 'QUOTA_OR_RATE_LIMIT'
        : /timeout|abort|ETIMEDOUT|fetch failed|network|ENOTFOUND|ECONNRESET/i.test(message)
          ? 'NETWORK_OR_TIMEOUT'
          : 'OTHER_PROVIDER_ERROR';
  console.log(`LIVE_CALL_FAILED class=${cls} errorName=${name}`);
  console.log('(full message withheld; provider/SDK error details are not exposed here)');
  process.exit(1);
}
