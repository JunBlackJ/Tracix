// ═══════════════════════════════════════════
// API client — Tracix backend
// ═══════════════════════════════════════════

import type {
  UserApp, Organization, Member, Platform, AccessRight,
  System, NetworkFlow, Subscription, Alert, AuditTrail,
  AccessLevel, Category, ModuleId, CustomModule, CustomEntry,
} from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'tracix_token';

// ─── Token helpers ───
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Dashboard stats ───
export interface DashboardStats {
  totalMembers: number;
  totalMembersAll: number;
  totalPlatforms: number;
  adminCount: number;
  overdueReviews: number;
  avgRiskScore: number;
  membersWithoutReview: number;
  expiringSubs: number;
  criticalAlerts: number;
  totalAlerts: number;
  riskByTeam: { team: string; score: number; count: number }[];
  accessLevelDistribution: { name: string; value: number; color: string }[];
  riskHistory: { date: string; score: number }[];
}

// ─── Core request function ───
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body.details) {
        // Zod validation error — include field details
        const details = (body.details as { field: string; message: string }[])
          .map((d) => `${d.field ? d.field + ': ' : ''}${d.message}`)
          .join(' | ');
        message = `${body.error} — ${details}`;
      } else {
        message = body.message || body.error || message;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ─── API object ───
export const api = {
  auth: {
    login(email: string, password: string): Promise<{ token: string; user: UserApp; organization: Organization }> {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    register(data: { full_name: string; email: string; password: string; organization_name: string }): Promise<{ token: string; user: UserApp; organization: Organization }> {
      return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    logout(): Promise<void> {
      return request('/auth/logout', { method: 'POST' });
    },
    me(): Promise<{ user: UserApp; organization: Organization }> {
      return request('/auth/me');
    },
    updateOrganization(data: { name?: string; max_admin_per_platform?: number; access_review_delay_days?: number; subscription_alert_days?: number; enabled_modules?: ModuleId[]; plan?: string }): Promise<Organization> {
      return request('/auth/organization', { method: 'PUT', body: JSON.stringify(data) });
    },
    oauthUrl(provider: 'google' | 'microsoft' | 'github'): string {
      return `${BASE_URL}/auth/oauth/${provider}`;
    },
  },

  members: {
    list(): Promise<Member[]> {
      return request('/members');
    },
    get(id: string): Promise<Member> {
      return request(`/members/${id}`);
    },
    create(data: Partial<Member>): Promise<Member> {
      return request('/members', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Member>): Promise<Member> {
      return request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/members/${id}`, { method: 'DELETE' });
    },
    risk(id: string): Promise<Member> {
      return request(`/members/${id}/risk`);
    },
  },

  platforms: {
    list(): Promise<Platform[]> {
      return request('/platforms');
    },
    get(id: string): Promise<Platform> {
      return request(`/platforms/${id}`);
    },
    create(data: Partial<Platform>): Promise<Platform> {
      return request('/platforms', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Platform>): Promise<Platform> {
      return request(`/platforms/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/platforms/${id}`, { method: 'DELETE' });
    },
  },

  accessRights: {
    list(params?: { member_id?: string; platform_id?: string }): Promise<AccessRight[]> {
      const qs = params
        ? '?' + new URLSearchParams(params as Record<string, string>).toString()
        : '';
      return request(`/access-rights${qs}`);
    },
    get(id: string): Promise<AccessRight> {
      return request(`/access-rights/${id}`);
    },
    create(data: Partial<AccessRight>): Promise<AccessRight> {
      return request('/access-rights', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<AccessRight>): Promise<AccessRight> {
      return request(`/access-rights/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/access-rights/${id}`, { method: 'DELETE' });
    },
    updateLevel(id: string, level: AccessLevel, comment?: string): Promise<AccessRight> {
      return request(`/access-rights/${id}/level`, {
        method: 'PUT',
        body: JSON.stringify({ level, comment }),
      });
    },
    revoke(id: string, comment?: string): Promise<AccessRight> {
      return request(`/access-rights/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
    },
  },

  systems: {
    list(): Promise<System[]> {
      return request('/systems');
    },
    get(id: string): Promise<System> {
      return request(`/systems/${id}`);
    },
    create(data: Partial<System>): Promise<System> {
      return request('/systems', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<System>): Promise<System> {
      return request(`/systems/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/systems/${id}`, { method: 'DELETE' });
    },
  },

  networkFlows: {
    list(): Promise<NetworkFlow[]> {
      return request('/network-flows');
    },
    get(id: string): Promise<NetworkFlow> {
      return request(`/network-flows/${id}`);
    },
    create(data: Partial<NetworkFlow>): Promise<NetworkFlow> {
      return request('/network-flows', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<NetworkFlow>): Promise<NetworkFlow> {
      return request(`/network-flows/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/network-flows/${id}`, { method: 'DELETE' });
    },
  },

  subscriptions: {
    list(): Promise<Subscription[]> {
      return request('/subscriptions');
    },
    get(id: string): Promise<Subscription> {
      return request(`/subscriptions/${id}`);
    },
    create(data: Partial<Subscription>): Promise<Subscription> {
      return request('/subscriptions', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Subscription>): Promise<Subscription> {
      return request(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/subscriptions/${id}`, { method: 'DELETE' });
    },
  },

  alerts: {
    list(params?: { is_resolved?: boolean; severity?: string }): Promise<Alert[]> {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries(params).map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : '';
      return request(`/alerts${qs}`);
    },
    resolve(id: string): Promise<Alert> {
      return request(`/alerts/${id}/resolve`, { method: 'PATCH' });
    },
    resolveAll(ids: string[]): Promise<{ resolved: number }> {
      return request('/alerts/resolve-all', {
        method: 'PATCH',
        body: JSON.stringify({ ids }),
      });
    },
  },

  auditTrail: {
    list(params?: { page?: number; limit?: number }): Promise<{ data: AuditTrail[]; total: number; page: number; limit: number }> {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries(params).map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : '';
      return request(`/audit-trail${qs}`);
    },
  },

  dashboard: {
    stats(): Promise<DashboardStats> {
      return request('/dashboard/stats');
    },
  },

  plan: {
    limits(): Promise<{
      plan: string;
      limits: {
        members: number; platforms: number; customModules: number;
        categories: number; seats: number; exportEnabled: boolean;
        customModulesEnabled: boolean; invitationsEnabled: boolean;
      };
      usage: { members: number; platforms: number; customModules: number; categories: number; seats: number };
    }> {
      return request('/auth/plan-limits');
    },
  },

  invitations: {
    list(): Promise<{ id: string; email: string | null; role: string; token: string; expires_at: string; accepted_at: string | null; invite_url: string }[]> {
      return request('/invitations');
    },
    create(role: 'viewer' | 'editor', email?: string): Promise<{ id: string; role: string; token: string; invite_url: string; expires_at: string }> {
      return request('/invitations', { method: 'POST', body: JSON.stringify({ role, email }) });
    },
    revoke(id: string): Promise<void> {
      return request(`/invitations/${id}`, { method: 'DELETE' });
    },
    preview(token: string): Promise<{ organization_name: string; role: string; expires_at: string }> {
      return request(`/invitations/preview/${token}`);
    },
    accept(token: string, data: { full_name?: string; email: string; password?: string }): Promise<{ token: string; user: UserApp; organization: Organization }> {
      return request(`/invitations/accept/${token}`, { method: 'POST', body: JSON.stringify(data) });
    },
  },

  customModules: {
    list(): Promise<CustomModule[]> {
      return request('/custom-modules');
    },
    get(id: string): Promise<CustomModule & { entries: CustomEntry[] }> {
      return request(`/custom-modules/${id}`);
    },
    create(data: Partial<CustomModule>): Promise<CustomModule> {
      return request('/custom-modules', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<CustomModule>): Promise<CustomModule> {
      return request(`/custom-modules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/custom-modules/${id}`, { method: 'DELETE' });
    },
    createEntry(moduleId: string, data: Record<string, unknown>): Promise<CustomEntry> {
      return request(`/custom-modules/${moduleId}/entries`, { method: 'POST', body: JSON.stringify({ data }) });
    },
    updateEntry(moduleId: string, entryId: string, data: Record<string, unknown>): Promise<CustomEntry> {
      return request(`/custom-modules/${moduleId}/entries/${entryId}`, { method: 'PUT', body: JSON.stringify({ data }) });
    },
    deleteEntry(moduleId: string, entryId: string): Promise<void> {
      return request(`/custom-modules/${moduleId}/entries/${entryId}`, { method: 'DELETE' });
    },
  },

  organizations: {
    list(): Promise<{ org: Organization; role: string }[]> {
      return request('/organizations');
    },
    create(name: string): Promise<{ org: Organization; role: string }> {
      return request('/organizations', { method: 'POST', body: JSON.stringify({ name }) });
    },
    switch(orgId: string): Promise<{ token: string; user: UserApp; organization: Organization }> {
      return request(`/organizations/${orgId}/switch`, { method: 'POST' });
    },
  },

  import: {
    batch(data: {
      members: { full_name: string; email?: string; team?: string }[];
      platforms: { name: string }[];
      access: { memberName: string; platformName: string; level: 'admin' | 'rw' | 'ro' | 'req' }[];
    }): Promise<{ created: { members: number; platforms: number; accessRights: number }; skipped: { members: number; platforms: number } }> {
      return request('/import/batch', { method: 'POST', body: JSON.stringify(data) });
    },
    analyze(data: { rawRows: string[][] }): Promise<{
      headerRowIndex: number;
      dataEndRow: number | null;
      memberCol: number | null;
      teamCol: number | null;
      emailCol: number | null;
      platformCols: number[];
      levelMappings: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    }> {
      return request('/import/analyze', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  categories: {
    list(type?: string): Promise<Category[]> {
      return request(`/categories${type ? `?type=${type}` : ''}`);
    },
    create(data: { type: string; label: string; color?: string }): Promise<Category> {
      return request('/categories', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<{ label: string; color: string }>): Promise<Category> {
      return request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string): Promise<void> {
      return request(`/categories/${id}`, { method: 'DELETE' });
    },
  },
};
