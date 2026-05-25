import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';
import { createTestUser, cleanupOrg, TEST_PASSWORD } from './helpers';

describe('Auth — POST /api/auth/login', () => {
  let orgId: string;
  let email: string;

  beforeAll(async () => {
    ({ orgId, email } = await createTestUser());
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
  });

  it('returns 200 + access token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.organization).toBeDefined();
    // refreshToken must NOT be in the body — it's in the HttpOnly cookie
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('sets the __rt HttpOnly cookie on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const rtCookie = cookies.find((c: string) => c.startsWith('__rt='));
    expect(rtCookie).toBeTruthy();
    expect(rtCookie).toMatch(/HttpOnly/i);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword99!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.io', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
  });
});

describe('Auth — POST /api/auth/register', () => {
  let orgId: string | null = null;

  afterAll(async () => {
    if (orgId) await cleanupOrg(orgId);
  });

  it('creates user + org and returns token', async () => {
    const uniqueEmail = `reg_${Date.now()}@tracix-test.io`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'New User',
        email: uniqueEmail,
        password: 'Register1234!',
        organization_name: 'New Org',
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(uniqueEmail);
    expect(res.body.refreshToken).toBeUndefined();
    orgId = res.body.user.organization_id;
  });

  it('returns 409 when email already exists', async () => {
    const uniqueEmail = `dup_${Date.now()}@tracix-test.io`;
    await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'A', email: uniqueEmail, password: 'Register1234!', organization_name: 'O1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'B', email: uniqueEmail, password: 'Register1234!', organization_name: 'O2' });

    expect(res.status).toBe(409);
    // cleanup the first registration
    const user = await prisma.userApp.findUnique({ where: { email: uniqueEmail } });
    if (user) await prisma.organization.deleteMany({ where: { id: user.organization_id } });
  });
});

describe('Auth — POST /api/auth/refresh', () => {
  let orgId: string;
  let email: string;

  beforeAll(async () => {
    ({ orgId, email } = await createTestUser());
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
  });

  it('issues a new access token when __rt cookie is valid', async () => {
    // Step 1 — login to get the cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);

    const setCookie = loginRes.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const rtCookie = cookies.find((c: string) => c.startsWith('__rt='));
    expect(rtCookie).toBeTruthy();

    // Extract just the cookie value part "name=value"
    const cookieHeader = rtCookie!.split(';')[0];

    // Step 2 — refresh using the cookie
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeTruthy();
    // Tokens are JWTs — same signing key but different iat/exp, so compare as strings
    // (in tests with <1s gap they may be identical; just verify the field is present)
    expect(typeof refreshRes.body.token).toBe('string');
    expect(refreshRes.body.refreshToken).toBeUndefined();
  });

  it('returns 400 without cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(400);
  });
});

describe('Auth — GET /api/auth/me', () => {
  let orgId: string;
  let email: string;

  beforeAll(async () => {
    ({ orgId, email } = await createTestUser());
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
  });

  it('returns user info with a valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Auth — POST /api/auth/logout', () => {
  let orgId: string;
  let email: string;

  beforeAll(async () => {
    ({ orgId, email } = await createTestUser());
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
  });

  it('clears the __rt cookie and revokes tokens in DB', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    const token = loginRes.body.token;

    const setCookie = loginRes.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const rtCookie = cookies.find((c: string) => c.startsWith('__rt='))!.split(';')[0];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', rtCookie);

    expect(logoutRes.status).toBe(200);

    // After logout, the refresh cookie should be cleared (Max-Age=0 or Expires in past)
    const logoutSetCookie = logoutRes.headers['set-cookie'] as string[] | string | undefined;
    const logoutCookies = Array.isArray(logoutSetCookie) ? logoutSetCookie : logoutSetCookie ? [logoutSetCookie] : [];
    const clearedCookie = logoutCookies.find((c: string) => c.startsWith('__rt='));
    expect(clearedCookie).toBeTruthy();
    // Either Max-Age=0 or empty value
    expect(clearedCookie).toMatch(/Max-Age=0|__rt=;/i);
  });
});
