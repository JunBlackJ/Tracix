import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma client before importing the service
vi.mock('../../prisma/client', () => ({
  default: {
    member: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../../prisma/client';
import { computeMemberRisk } from '../risk.service';

const mockMember = (overrides = {}) => ({
  id: 'member-1',
  full_name: 'Test User',
  status: 'actif',
  departure_date: null,
  account_type: 'nominatif',
  accessRights: [],
  organization: {
    max_admin_per_platform: 3,
    access_review_delay_days: 90,
  },
  ...overrides,
});

describe('computeMemberRisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns score 100 for member with no access rights', async () => {
    (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember());
    const result = await computeMemberRisk('member-1');
    expect(result.score).toBe(100);
    // The service adds a "no risk" informational factor when no penalties are found
    const hasOnlyInfoFactor = result.factors.every(f => f.delta === 0);
    expect(hasOnlyInfoFactor).toBe(true);
  });

  it('penalizes member with departed date and active accesses', async () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember({
      departure_date: pastDate.toISOString(),
      status: 'actif',
      accessRights: [{ level: 'ro', platform: {}, last_review_date: new Date().toISOString() }],
    }));
    const result = await computeMemberRisk('member-1');
    expect(result.score).toBeLessThan(100);
    const hasOffboardingFactor = result.factors.some(f => f.delta < 0);
    expect(hasOffboardingFactor).toBe(true);
  });

  it('score is always between 0 and 100', async () => {
    const pastDate = new Date(2000, 0, 1);
    const oldReviewDate = new Date(2000, 0, 1).toISOString();
    (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember({
      departure_date: pastDate.toISOString(),
      status: 'actif',
      account_type: 'service',
      accessRights: [
        { level: 'admin', platform: { has_mfa: false }, last_review_date: oldReviewDate },
        { level: 'admin', platform: { has_mfa: false }, last_review_date: oldReviewDate },
        { level: 'admin', platform: { has_mfa: false }, last_review_date: oldReviewDate },
        { level: 'admin', platform: { has_mfa: false }, last_review_date: oldReviewDate },
      ],
    }));
    const result = await computeMemberRisk('member-1');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
