import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLocalPasscode } from '@veridian/domain/auth';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, '.env');
const envTemplatePath = join(root, '.env.example');
const privateDirectory = join(root, 'private');
const credentialsPath = join(privateDirectory, 'REVIEWER_CREDENTIALS.txt');

try {
  await access(envPath, constants.F_OK);
  console.info('Existing .env was preserved.');
} catch {
  await copyFile(envTemplatePath, envPath);
  console.info('Created ignored .env from .env.example.');
}

let env = await readFile(envPath, 'utf8');
const hasConfiguredReviewer = /(?:^|\n)DEMO_REVIEWER_PASSWORD=(?!\s*(?:replace|$))/i.test(env);
if (!hasConfiguredReviewer) {
  const reviewerPassword = generateLocalPasscode();
  const replace = (name: string, value: string) => {
    const expression = new RegExp(`^${name}=.*$`, 'm');
    env = expression.test(env) ? env.replace(expression, `${name}=${value}`) : `${env.trimEnd()}\n${name}=${value}\n`;
  };
  replace('DEMO_REVIEWER_EMAIL', 'reviewer@veridian.local');
  replace('DEMO_REVIEWER_NAME', 'Demo Reviewer');
  replace('DEMO_REVIEWER_PASSWORD', reviewerPassword);
  await writeFile(envPath, env, 'utf8');
  await mkdir(privateDirectory, { recursive: true });
  await writeFile(credentialsPath, `Veridian Service Desk local demo reviewer\nEmail: reviewer@veridian.local\nPassword: ${reviewerPassword}\n`, { encoding: 'utf8', mode: 0o600 });
  console.info(`Generated local reviewer credentials at ${credentialsPath}.`);
} else {
  console.info('Existing demo reviewer configuration was preserved.');
}

console.info('Next: npm install, then npm run db:bootstrap, then npm run dev (or docker compose up --build).');
