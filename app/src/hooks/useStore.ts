// ═══════════════════════════════════════════
// Store global — gestion d'état de l'application
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import type {
  UserApp, Organization, Member, Platform, AccessRight,
  System, NetworkFlow, Subscription, Alert, AuditTrail,
  AccessLevel, Category, CustomModule,
} from '@/types';
import { api, getToken, setToken, clearToken } from '@/lib/api';

export interface OrgEntry { org: Organization; role: string; }

export function useStore() {
  const [user, setUser] = useState<UserApp | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accessRights, setAccessRights] = useState<AccessRight[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [networkFlows, setNetworkFlows] = useState<NetworkFlow[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditTrail] = useState<AuditTrail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customModules, setCustomModules] = useState<CustomModule[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userOrganizations, setUserOrganizations] = useState<OrgEntry[]>([]);

  // ─── Load all data after authentication ───
  const loadAllData = useCallback(async () => {
    const [
      membersData,
      platformsData,
      accessRightsData,
      systemsData,
      networkFlowsData,
      subscriptionsData,
      alertsData,
      categoriesData,
      customModulesData,
    ] = await Promise.all([
      api.members.list(),
      api.platforms.list(),
      api.accessRights.list(),
      api.systems.list(),
      api.networkFlows.list(),
      api.subscriptions.list(),
      api.alerts.list(),
      api.categories.list(),
      api.customModules.list(),
    ]);

    setMembers(membersData);
    setPlatforms(platformsData);
    setAccessRights(accessRightsData);
    setSystems(systemsData);
    setNetworkFlows(networkFlowsData);
    setSubscriptions(subscriptionsData);
    setAlerts(alertsData);
    setCategories(categoriesData);
    setCustomModules(customModulesData);

    // Charger la liste des orgs de l'utilisateur
    try {
      const orgs = await api.organizations.list();
      setUserOrganizations(orgs);
    } catch {
      // non bloquant
    }
  }, []);

  // ─── On mount: restore session from token ───
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const { user: u, organization: org } = await api.auth.me();
        setUser(u);
        setOrganization(org);
        setIsAuthenticated(true);
        await loadAllData();
      } catch {
        // Token invalid/expired — clear it
        clearToken();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadAllData]);

  // ─── Login ───
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { token, user: u, organization: org } = await api.auth.login(email, password);
      setToken(token);
      setUser(u);
      setOrganization(org);
      setIsAuthenticated(true);
      await loadAllData();
      return true;
    } catch {
      return false;
    }
  }, [loadAllData]);

  // ─── Register ───
  const register = useCallback(async (data: { full_name: string; email: string; password: string; organization_name: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { token, user: u, organization: org } = await api.auth.register(data);
      setToken(token);
      setUser(u);
      setOrganization(org);
      setIsAuthenticated(true);
      await loadAllData();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      return { success: false, error: message };
    }
  }, [loadAllData]);

  // ─── Login with token (OAuth callback) ───
  const loginWithToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      setToken(token);
      const { user: u, organization: org } = await api.auth.me();
      setUser(u);
      setOrganization(org);
      setIsAuthenticated(true);
      await loadAllData();
      return true;
    } catch {
      clearToken();
      return false;
    }
  }, [loadAllData]);

  // ─── Logout ───
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore errors during logout
    } finally {
      clearToken();
      setIsAuthenticated(false);
      setUser(null);
      setOrganization(null);
      setMembers([]);
      setPlatforms([]);
      setAccessRights([]);
      setSystems([]);
      setNetworkFlows([]);
      setSubscriptions([]);
      setAlerts([]);
    }
  }, []);

  // ─── Resolve a single alert ───
  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      const updated = await api.alerts.resolve(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
    } catch {
      // silently fail — alert stays unresolved in UI
    }
  }, []);

  // ─── Resolve multiple alerts ───
  const resolveAllAlerts = useCallback(async (alertIds: string[]) => {
    try {
      await api.alerts.resolveAll(alertIds);
      // Re-fetch alerts to get accurate resolved state
      const updated = await api.alerts.list();
      setAlerts(updated);
    } catch {
      // silently fail
    }
  }, []);

  // ─── Update access level ───
  const updateAccessLevel = useCallback(async (
    accessRightId: string,
    newLevel: AccessLevel,
    comment?: string,
  ) => {
    try {
      const updated = await api.accessRights.updateLevel(accessRightId, newLevel, comment);
      setAccessRights((prev) =>
        prev.map((a) => (a.id === accessRightId ? updated : a))
      );

      // Refresh the affected member's risk score
      const memberId = updated.member_id;
      try {
        const refreshedMember = await api.members.risk(memberId);
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? refreshedMember : m))
        );
      } catch {
        // ignore risk refresh failure
      }
    } catch {
      // silently fail
    }
  }, []);

  // ─── Revoke access ───
  const revokeAccess = useCallback(async (accessRightId: string, comment?: string) => {
    try {
      const updated = await api.accessRights.revoke(accessRightId, comment);
      setAccessRights((prev) =>
        prev.map((a) => (a.id === accessRightId ? updated : a))
      );

      // Refresh the affected member's risk score
      const memberId = updated.member_id;
      try {
        const refreshedMember = await api.members.risk(memberId);
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? refreshedMember : m))
        );
      } catch {
        // ignore risk refresh failure
      }
    } catch {
      // silently fail
    }
  }, []);

  // ─── Refresh alerts ───
  const refreshAlerts = useCallback(async () => {
    try {
      const updated = await api.alerts.list();
      setAlerts(updated);
    } catch {
      // silently fail
    }
  }, []);

  // ─── Add or update a single member in local state ───
  const upsertMember = useCallback((m: Member) => {
    setMembers((prev) => {
      const exists = prev.some((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m];
    });
  }, []);

  // ─── Add or update a single subscription in local state ───
  const upsertSubscription = useCallback((s: Subscription) => {
    setSubscriptions((prev) => {
      const exists = prev.some((x) => x.id === s.id);
      return exists ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s];
    });
  }, []);

  // ─── Add or update a single system in local state ───
  const upsertSystem = useCallback((s: System) => {
    setSystems((prev) => {
      const exists = prev.some((x) => x.id === s.id);
      return exists ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s];
    });
  }, []);

  // ─── Add or update a single platform in local state ───
  const upsertPlatform = useCallback((p: Platform) => {
    setPlatforms((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
  }, []);

  // ─── Add or update a single network flow in local state ───
  const upsertNetworkFlow = useCallback((f: NetworkFlow) => {
    setNetworkFlows((prev) => {
      const exists = prev.some((x) => x.id === f.id);
      return exists ? prev.map((x) => (x.id === f.id ? f : x)) : [...prev, f];
    });
  }, []);

  // ─── Add category ───
  const addCategory = useCallback((c: Category) => {
    setCategories((prev) => [...prev, c]);
  }, []);

  // ─── Remove category ───
  const removeCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ─── Custom modules ───
  const upsertCustomModule = useCallback((m: CustomModule) => {
    setCustomModules((prev) => {
      const exists = prev.some((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m];
    });
  }, []);

  const removeCustomModule = useCallback((id: string) => {
    setCustomModules((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ─── Switch organization ───
  const switchOrganization = useCallback(async (orgId: string): Promise<boolean> => {
    try {
      const { token, user: u, organization: org } = await api.organizations.switch(orgId);
      setToken(token);
      setUser(u);
      setOrganization(org);
      // Recharger toutes les données de la nouvelle org
      await loadAllData();
      return true;
    } catch {
      return false;
    }
  }, [loadAllData]);

  // ─── Create organization ───
  const createOrganization = useCallback(async (name: string): Promise<boolean> => {
    try {
      const { org, role } = await api.organizations.create(name);
      setUserOrganizations((prev) => [...prev, { org, role }]);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    user,
    organization,
    members,
    platforms,
    accessRights,
    systems,
    networkFlows,
    subscriptions,
    alerts,
    auditTrail,
    isAuthenticated,
    isLoading,
    login,
    register,
    loginWithToken,
    logout,
    resolveAlert,
    resolveAllAlerts,
    updateAccessLevel,
    revokeAccess,
    refreshAlerts,
    upsertMember,
    upsertSubscription,
    categories,
    addCategory,
    removeCategory,
    setOrganization,
    customModules,
    upsertCustomModule,
    removeCustomModule,
    userOrganizations,
    switchOrganization,
    createOrganization,
    upsertSystem,
    upsertPlatform,
    upsertNetworkFlow,
  };
}
