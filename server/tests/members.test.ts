import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, cleanupOrg, TEST_PASSWORD } from './helpers';

describe('Members lifecycle — CRUD + RBAC', () => {
  let orgId: string;
  let email: string;
  let adminToken: string;
  let viewerToken: string;
  let createdMemberId: string;

  beforeAll(async () => {
    // Admin user
    ({ orgId, email } = await createTestUser({ role: 'admin' }));
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    adminToken = loginRes.body.token;

    // Viewer user in same org (register then update role via DB)
    const { email: vEmail } = await createTestUser({ role: 'viewer' });
    const vLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: vEmail, password: TEST_PASSWORD });
    viewerToken = vLogin.body.token;
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
  });

  it('GET /api/members returns 200 for admin', async () => {
    const res = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/members returns 200 for viewer (members.read)', async () => {
    const res = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
  });

  it('GET /api/members returns 401 without token', async () => {
    const res = await request(app).get('/api/members');
    expect(res.status).toBe(401);
  });

  it('POST /api/members creates a member (admin)', async () => {
    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Alice Test',
        username: `alice_${Date.now()}`,
        email: `alice_${Date.now()}@test.io`,
        account_type: 'nominatif',
        team: 'QA',
      });

    expect(res.status).toBe(201);
    expect(res.body.full_name).toBe('Alice Test');
    createdMemberId = res.body.id;
  });

  it('POST /api/members returns 403 for viewer (no members.write)', async () => {
    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        full_name: 'Bob Unauthorized',
        username: `bob_${Date.now()}`,
        email: `bob_${Date.now()}@test.io`,
        account_type: 'nominatif',
      });

    expect(res.status).toBe(403);
  });

  it('GET /api/members/:id returns the created member', async () => {
    const res = await request(app)
      .get(`/api/members/${createdMemberId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdMemberId);
  });

  it('PUT /api/members/:id updates team', async () => {
    const res = await request(app)
      .put(`/api/members/${createdMemberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ team: 'Engineering' });

    expect(res.status).toBe(200);
    expect(res.body.team).toBe('Engineering');
  });

  it('DELETE /api/members/:id removes the member', async () => {
    const res = await request(app)
      .delete(`/api/members/${createdMemberId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('GET /api/members/:id returns 404 after deletion', async () => {
    const res = await request(app)
      .get(`/api/members/${createdMemberId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('Members — input validation', () => {
  let orgId: string;
  let adminToken: string;

  beforeAll(async () => {
    let email: string;
    ({ orgId, email } = await createTestUser());
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    adminToken = loginRes.body.token;
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'No Email' }); // missing username, email, account_type

    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Bad Email',
        username: 'bad_email',
        email: 'not-an-email',
        account_type: 'nominatif',
      });

    expect(res.status).toBe(400);
  });
});
