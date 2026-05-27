import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, cleanupOrg, TEST_PASSWORD } from './helpers';

describe('Network Flows — CRUD + pagination', () => {
  let orgId: string;
  let adminToken: string;
  let createdFlowId: string;

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

  it('GET /api/network-flows returns paginated response', async () => {
    const res = await request(app)
      .get('/api/network-flows')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  it('POST /api/network-flows creates a flow', async () => {
    const res = await request(app)
      .post('/api/network-flows')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        flow_id: `FLW-${Date.now()}`,
        source_host: '10.0.1.1',
        source_zone: 'LAN',
        destination_host: '10.0.2.1',
        destination_zone: 'DMZ',
        port: '443',
        protocol: 'TCP',
        service: 'HTTPS',
        direction: 'sortant',
        status: 'autorisé',
      });

    expect(res.status).toBe(201);
    expect(res.body.source_host).toBe('10.0.1.1');
    createdFlowId = res.body.id;
  });

  it('GET /api/network-flows/:id returns the created flow', async () => {
    const res = await request(app)
      .get(`/api/network-flows/${createdFlowId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdFlowId);
  });

  it('PUT /api/network-flows/:id updates the flow', async () => {
    const res = await request(app)
      .put(`/api/network-flows/${createdFlowId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'bloqué', justification: 'Security audit' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('bloqué');
  });

  it('DELETE /api/network-flows/:id removes the flow', async () => {
    const res = await request(app)
      .delete(`/api/network-flows/${createdFlowId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('GET /api/network-flows/:id returns 404 after deletion', async () => {
    const res = await request(app)
      .get(`/api/network-flows/${createdFlowId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/network-flows returns 401 without token', async () => {
    const res = await request(app).get('/api/network-flows');
    expect(res.status).toBe(401);
  });

  it('POST /api/network-flows returns 400 on missing flow_id', async () => {
    const res = await request(app)
      .post('/api/network-flows')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source_host: '10.0.0.1' }); // flow_id required

    expect(res.status).toBe(400);
  });
});
