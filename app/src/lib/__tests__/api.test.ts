import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getToken, setToken, clearToken } from '../api';

describe('token helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('getToken returns null when no token stored', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken stores and getToken retrieves', () => {
    setToken('my-jwt-token');
    expect(getToken()).toBe('my-jwt-token');
  });

  it('clearToken removes stored token', () => {
    setToken('my-jwt-token');
    clearToken();
    expect(getToken()).toBeNull();
  });
});
