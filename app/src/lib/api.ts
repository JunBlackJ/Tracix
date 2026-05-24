// ═══════════════════════════════════════════
// API client — Tracix backend
// ═══════════════════════════════════════════

import type {
  UserApp, Organization, Member, Platform, AccessRight,
  System, NetworkFlow, Subscription, Alert, AuditTrail,
  AccessLevel, Category, ModuleId, CustomModule, CustomEntry,
  ReviewCampaign, ReviewItem,
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
  totalAccessRights: number;
  riskDistribution: { crit: number; high: number; med: number; low: number };
  riskByTeam: { team: string; score: number; count: number }[];
  accessLevelDistribution: { name: string; value: number; color: string }[];
  riskHistory: { date: string; score: number }[];
  mfaDisabledCount: number;
  inactiveWithAccess: number;
  multiPlatformCount: number;
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

  // Timeout 15s sur toutes les requêtes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('La requête a expiré — vérifiez votre connexion.');
    }
    throw new Error('Impossible de contacter le serveur — vérifiez votre connexion.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body.details) {
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
    updateOrganization(data: { name?: string; max_admin_per_platform?: number; access_review_delay_days?: number; subscription_alert_days?: number; enabled_modules?: ModuleId[]; plan?: string; alert_email_enabled?: boolean; alert_email_address?: string; alert_email_frequency?: string }): Promise<Organization> {
      return request('/auth/organization', { method: 'PUT', body: JSON.stringify(data) });
    },
    oauthUrl(provider: 'google' | 'microsoft' | 'github'): string {
      return `${BASE_URL}/auth/oauth/${provider}`;
    },
    testEmail(): Promise<{ success: boolean; sent_to: string }> {
      return request('/auth/test-email', { method: 'POST' });
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
    offboard(id: string): Promise<{ success: boolean; revokedCount: number; member: Member }> {
      return request(`/members/${id}/offboard`, { method: 'POST' });
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
    getAdvice(id: string): Promise<{ advice: string; remaining: number; limit: number }> {
      return request(`/alerts/${id}/advice`, { method: 'POST' });
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
    reset(password?: string): Promise<{ success: boolean }> {
      return request('/organizations/reset', { method: 'POST', body: JSON.stringify({ password }) });
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
      fileType: 'access_matrix' | 'access_matrix_transposed' | 'platform_inventory' | 'subscription_inventory' | 'system_inventory' | 'network_flow_inventory' | 'member_list' | 'unknown';
      headerRowIndex: number;
      subHeaderRowIndex: number | null;
      dataEndRow: number | null;
      warnings: string[];
      memberCol: number | null;
      firstNameCol: number | null;
      lastNameCol: number | null;
      teamCol: number | null;
      emailCol: number | null;
      platformCols: number[];
      levelMappings: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>;
      memberRow: number | null;
      platformCol: number | null;
      nameCol: number | null;
      categoryCol: number | null;
      urlCol: number | null;
      vendorCol: number | null;
      renewalCol: number | null;
      statusCol: number | null;
      costMonthlyCol: number | null;
      costAnnualCol: number | null;
      currencyCol: number | null;
      ipCol: number | null;
      osCol: number | null;
      typeCol: number | null;
      criticalityCol: number | null;
      responsibleCol: number | null;
      sourceCol: number | null;
      destinationCol: number | null;
      portCol: number | null;
      protocolCol: number | null;
      directionCol: number | null;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    }> {
      return request('/import/analyze', { method: 'POST', body: JSON.stringify(data) });
    },
    batchPlatforms(data: { platforms: { name: string; category?: string; url?: string; status?: string }[] }): Promise<{ created: number; skipped: number }> {
      return request('/import/batch-platforms', { method: 'POST', body: JSON.stringify(data) });
    },
    batchSubscriptions(data: { subscriptions: { name: string; vendor?: string; category?: string; renewal_date?: string; status?: string }[] }): Promise<{ created: number; skipped: number }> {
      return request('/import/batch-subscriptions', { method: 'POST', body: JSON.stringify(data) });
    },
    batchMembers(data: { members: { full_name: string; email?: string; team?: string }[] }): Promise<{ created: number; skipped: number }> {
      return request('/import/batch-members', { method: 'POST', body: JSON.stringify(data) });
    },
    batchSystems(data: { systems: { name: string; ip_address?: string; os_version?: string; type?: string; criticality?: string; status?: string; responsible?: string }[] }): Promise<{ created: number; skipped: number }> {
      return request('/import/batch-systems', { method: 'POST', body: JSON.stringify(data) });
    },
    batchNetworkFlows(data: { flows: { source: string; destination: string; port?: string; protocol?: string; status?: string; direction?: string }[] }): Promise<{ created: number; skipped: number }> {
      return request('/import/batch-network-flows', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  reviews: {
    list(): Promise<ReviewCampaign[]> {
      return request('/reviews');
    },
    create(data: { name: string; description?: string; due_date?: string; platformIds?: string[]; teamFilter?: string }): Promise<ReviewCampaign> {
      return request('/reviews', { method: 'POST', body: JSON.stringify(data) });
    },
    get(id: string): Promise<ReviewCampaign & { items: ReviewItem[] }> {
      return request(`/reviews/${id}`);
    },
    decide(campaignId: string, itemId: string, data: { decision: 'confirmed' | 'revoked' | 'modified'; new_level?: string; comment?: string }): Promise<ReviewItem> {
      return request(`/reviews/${campaignId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    bulk(campaignId: string, data: { itemIds: string[]; decision: 'confirmed' | 'revoked'; comment?: string }): Promise<{ processed: number; remaining: number }> {
      return request(`/reviews/${campaignId}/bulk`, { method: 'POST', body: JSON.stringify(data) });
    },
    complete(id: string): Promise<{ success: boolean }> {
      return request(`/reviews/${id}/complete`, { method: 'POST' });
    },
    delete(id: string): Promise<void> {
      return request(`/reviews/${id}`, { method: 'DELETE' });
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

  saml: {
    getConfig(): Promise<{
      configured: boolean;
      id?: string;
      entity_id?: string;
      sso_url?: string;
      certificate?: string;
      is_enabled?: boolean;
      metadata_url?: string;
      login_url?: string;
    }> {
      return request('/saml/config');
    },
    saveConfig(data: { entity_id: string; sso_url: string; certificate: string; is_enabled: boolean }): Promise<{
      configured: boolean;
      entity_id: string;
      sso_url: string;
      certificate: string;
      is_enabled: boolean;
      metadata_url: string;
      login_url: string;
    }> {
      return request('/saml/config', { method: 'POST', body: JSON.stringify(data) });
    },
    deleteConfig(): Promise<{ success: boolean }> {
      return request('/saml/config', { method: 'DELETE' });
    },
  },

  reports: {
    generate(data: Record<string, unknown>): Promise<{
      executiveSummary: string;
      accessControl: string;
      riskAnalysis: string;
      subscriptionGovernance: string;
      systemCompliance: string;
      alertsSummary: string;
      recommendations: string;
      conclusion: string;
    }> {
      return request('/reports/generate', { method: 'POST', body: JSON.stringify(data) });
    },
  },
};
