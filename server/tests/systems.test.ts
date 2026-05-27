import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, cleanupOrg, TEST_PASSWORD } from './helpers';

describe('Systems — CRUD + pagination', () => {
  let orgId: string;
  let adminToken: string;
  let createdSystemId: string;

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

  it('GET /api/systems returns paginated response', async () => {
    const res = await request(app)
      .get('/api/systems')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(0);
  });

  it('POST /api/systems creates a system', async () => {
    const res = await request(app)
      .post('/api/systems')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        system_id: `SRV-${Date.now()}`,
        hostname: 'srv-test-01',
        type: 'serveur',
        environment: 'production',
        os_version: 'Ubuntu 22.04',
        ip_address: '10.0.1.10',
        criticality: 'normale',
        status: 'actif',
      });

    expect(res.status).toBe(201);
    expect(res.body.hostname).toBe('srv-test-01');
    createdSystemId = res.body.id;
  });

  it('GET /api/systems/:id returns the created system', async () => {
    const res = await request(app)
      .get(`/api/systems/${createdSystemId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdSystemId);
    expect(res.body.hostname).toBe('srv-test-01');
  });

  it('PUT /api/systems/:id updates the system', async () => {
    const res = await request(app)
      .put(`/api/systems/${createdSystemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'maintenance', notes: 'Upgrading OS' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('maintenance');
    expect(res.body.notes).toBe('Upgrading OS');
  });

  it('DELETE /api/systems/:id removes the system', async () => {
    const res = await request(app)
      .delete(`/api/systems/${createdSystemId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('GET /api/systems/:id returns 404 after deletion', async () => {
    const res = await request(app)
      .get(`/api/systems/${createdSystemId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/systems returns 401 without token', async () => {
    const res = await request(app).get('/api/systems');
    expect(res.status).toBe(401);
  });

  it('GET /api/systems supports search filter', async () => {
    await request(app)
      .post('/api/systems')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        system_id: `SEARCH-${Date.now()}`,
        hostname: 'unique-searchable-host',
        environment: 'dev',
        criticality: 'faible',
        status: 'actif',
      });

    const res = await request(app)
      .get('/api/systems?search=unique-searchable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].hostname).toContain('unique-searchable');
  });

  it('GET /api/systems respects page & limit params', async () => {
    const res = await request(app)
      .get('/api/systems?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('POST /api/systems returns 400 on invalid input', async () => {
    const res = await request(app)
      .post('/api/systems')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hostname: '' }); // system_id is required and min(1)

    expect(res.status).toBe(400);
  });
});
