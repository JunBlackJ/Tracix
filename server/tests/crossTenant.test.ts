import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';
import { createTestUser, cleanupOrg, TEST_PASSWORD } from './helpers';
import { v4 as uuidv4 } from 'uuid';

describe('Cross-tenant isolation — org A token cannot access org B resources', () => {
  let orgA: string;
  let orgB: string;
  let tokenA: string;

  // Resources created in org B
  let memberBId: string;

  beforeAll(async () => {
    // Create org A user and login
    const { orgId: idA, email: emailA } = await createTestUser({ role: 'admin' });
    orgA = idA;
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: emailA, password: TEST_PASSWORD });
    tokenA = loginA.body.token;

    // Create org B with its own member
    const { orgId: idB } = await createTestUser({ role: 'admin' });
    orgB = idB;

    // Seed a member in org B directly via DB
    memberBId = 'member_b_' + uuidv4().slice(0, 8);
    await prisma.member.create({
      data: {
        id: memberBId,
        organization_id: orgB,
        full_name: 'Org B Member',
        email: `orgb_${Date.now()}@test.io`,
        username: `orgb_${Date.now()}`,
        account_type: 'nominatif',
        status: 'actif',
      },
    });
  });

  afterAll(async () => {
    await cleanupOrg(orgA);
    await cleanupOrg(orgB);
  });

  it('GET /api/members — returns only org A members, not org B', async () => {
    const res = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).not.toContain(memberBId);
  });

  it('GET /api/members/:id — returns 404 for org B member', async () => {
    const res = await request(app)
      .get(`/api/members/${memberBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('PUT /api/members/:id — returns 404 when modifying org B member', async () => {
    const res = await request(app)
      .put(`/api/members/${memberBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ team: 'Hacked' });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/members/:id — returns 404 when deleting org B member', async () => {
    const res = await request(app)
      .delete(`/api/members/${memberBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/alerts — returns only org A alerts, not org B', async () => {
    // Seed an alert in org B
    const alertBId = 'alert_b_' + uuidv4().slice(0, 8);
    await prisma.alert.create({
      data: {
        id: alertBId,
        organization_id: orgB,
        type: 'no_mfa_on_admin',
        severity: 'critical',
        message: 'Org B alert',
        source_label: 'Test',
        source_module: 'test',
        source_id: 'test_source',
        is_resolved: false,
      },
    });

    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const ids = (Array.isArray(res.body) ? res.body : res.body.data ?? [])
      .map((a: { id: string }) => a.id);
    expect(ids).not.toContain(alertBId);
  });

  it('GET /api/audit — returns only org A audit entries', async () => {
    // Seed an audit entry in org B
    const auditBId = 'audit_b_' + uuidv4().slice(0, 8);
    await prisma.auditTrail.create({
      data: {
        id: auditBId,
        organization_id: orgB,
        actor: 'orgb@test.io',
        action: 'test.entry',
        target_type: 'test',
        target_id: 'x',
        target_label: 'x',
        old_value: {},
        new_value: {},
        ip_address: '127.0.0.1',
        user_agent: 'test',
      },
    });

    const res = await request(app)
      .get('/api/audit-trail')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const ids = (Array.isArray(res.body) ? res.body : res.body.data ?? [])
      .map((e: { id: string }) => e.id);
    expect(ids).not.toContain(auditBId);
  });
});
