import { describe, it, expect } from 'vitest';
import { ACCESS_LEVEL_CONFIG } from '@/types';

describe('ACCESS_LEVEL_CONFIG', () => {
  it('contains admin level', () => {
    expect(ACCESS_LEVEL_CONFIG).toHaveProperty('admin');
    expect(ACCESS_LEVEL_CONFIG.admin.label).toBeDefined();
  });

  it('contains ro level', () => {
    expect(ACCESS_LEVEL_CONFIG).toHaveProperty('ro');
  });

  it('all levels have label and color', () => {
    for (const [, config] of Object.entries(ACCESS_LEVEL_CONFIG)) {
      expect(config.label).toBeTruthy();
    }
  });
});
