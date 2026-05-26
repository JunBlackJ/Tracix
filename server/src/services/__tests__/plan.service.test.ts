import { describe, it, expect } from 'vitest';
import { getLimits, checkLimit } from '../plan.service';

describe('getLimits', () => {
  it('free plan: 10 membres, 3 plateformes, 3 seats', () => {
    const l = getLimits('free');
    expect(l.members).toBe(10);
    expect(l.platforms).toBe(3);
    expect(l.seats).toBe(3);
    expect(l.exportEnabled).toBe(false);
  });

  it('pro plan: unlimited members/platforms, 5 seats', () => {
    const l = getLimits('pro');
    expect(l.members).toBe(-1);
    expect(l.platforms).toBe(-1);
    expect(l.seats).toBe(5);
    expect(l.exportEnabled).toBe(true);
  });

  it('enterprise plan: everything unlimited', () => {
    const l = getLimits('enterprise');
    expect(l.members).toBe(-1);
    expect(l.seats).toBe(-1);
  });

  it('unknown plan falls back to free', () => {
    const l = getLimits('unknown');
    expect(l.members).toBe(10);
  });
});

describe('checkLimit', () => {
  it('returns null when below limit', () => {
    expect(checkLimit(2, 3, 'membres')).toBeNull();
  });

  it('returns null when limit is -1 (unlimited)', () => {
    expect(checkLimit(999, -1, 'membres')).toBeNull();
  });

  it('returns error message when at limit', () => {
    const msg = checkLimit(3, 3, 'membres');
    expect(msg).not.toBeNull();
    expect(msg).toContain('3 max');
  });
});
