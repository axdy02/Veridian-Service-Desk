import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ignored = new Set(['node_modules', '.next', 'dist', '.git', 'private']);
const candidateExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.sql']);
const findings: string[] = [];

async function visit(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) await visit(join(directory, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!candidateExtensions.has(extension) || entry.name === '.env.example') continue;
    const file = join(directory, entry.name);
    const text = await readFile(file, 'utf8');
    if (/AIza[0-9A-Za-z_-]{30,}/.test(text) || /GEMINI_API_KEY\s*=\s*(?!\s*(?:$|['"]?(?:replace|your|example)))/i.test(text)) findings.push(file);
  }
}

await visit(root);
if (findings.length) {
  console.error(`Possible secret material found in: ${findings.join(', ')}`);
  process.exitCode = 1;
} else {
  console.info('Secret scan found no obvious committed credentials.');
}
