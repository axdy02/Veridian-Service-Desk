import 'dotenv/config';
import { ChatGoogle } from '@langchain/google';

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';
if (!apiKey) {
  console.info('Gemini smoke test NOT RUN: GEMINI_API_KEY is not configured. Offline mode remains available.');
} else {
  try {
    const client = new ChatGoogle({ apiKey, model, maxRetries: 0 });
    await client.invoke('Return the single word: ready', { signal: AbortSignal.timeout(18_000) });
    console.info(`Gemini smoke test succeeded with ${model}.`);
  } catch {
    console.error('Gemini smoke test failed without exposing provider details. Check key/model availability and retry.');
    process.exitCode = 1;
  }
}
