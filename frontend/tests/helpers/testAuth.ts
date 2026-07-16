/// <reference types="node" />
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TEST_EMAIL = 'e2e-my-routes@trippy-planner.test';
const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function psql(sql: string): void {
  execSync(`docker compose exec -T postgres psql -U trippy -d trippy -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`, {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
}

function randomToken(length = 20): string {
  let out = '';
  for (let i = 0; i < length; i++) out += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  return out;
}

// Creates (or reuses) a test user and inserts a fresh, valid session token
// directly into the database. This bypasses the real magic-link email flow
// (which would hit the live Resend API) and avoids relying on a hardcoded
// token that inevitably goes stale — the DB is the source of truth for auth.
export function createAuthenticatedSession(email: string = TEST_EMAIL): string {
  const token = randomToken();
  psql(`INSERT INTO users(email) VALUES ('${email}') ON CONFLICT (email) DO NOTHING;`);
  psql(`INSERT INTO sessions(token, user_id, expires_at) SELECT '${token}', id, now() + interval '1 day' FROM users WHERE email = '${email}';`);
  return token;
}
