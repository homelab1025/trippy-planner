const TEST_EMAIL = 'e2e-my-routes@trippy-planner.test';
const BACKEND_URL = 'http://localhost:8080';

export async function createAuthenticatedSession(email: string = TEST_EMAIL): Promise<string> {
  const magicLinkRes = await fetch(`${BACKEND_URL}/api/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!magicLinkRes.ok) {
    throw new Error(`POST /api/auth/magic-link failed: ${magicLinkRes.status} ${magicLinkRes.statusText}`);
  }

  const tokenRes = await fetch(`${BACKEND_URL}/api/test/magic-link-token?email=${encodeURIComponent(email)}`);
  if (!tokenRes.ok) {
    throw new Error(`GET /api/test/magic-link-token failed: ${tokenRes.status} ${tokenRes.statusText}`);
  }

  const { token } = (await tokenRes.json()) as { token: string };
  return token;
}
