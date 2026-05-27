import { create } from 'zustand';
import type { UserApp, Organization } from '@/types';
import { api, getToken, setToken, clearToken } from '@/lib/api';

export interface OrgEntry { org: Organization; role: string; }

interface AuthState {
  user: UserApp | null;
  organization: Organization | null;
  userOrganizations: OrgEntry[];
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: UserApp | null) => void;
  setOrganization: (org: Organization | null) => void;
  setUserOrganizations: (orgs: OrgEntry[]) => void;
  setIsAuthenticated: (val: boolean) => void;
  setIsLoading: (val: boolean) => void;

  login: (email: string, password: string) => Promise<{ ok: true } | { mfa_required: true; user_id: string } | { ok: false; error?: string }>;
  loginWithMfa: (userId: string, totp: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
  register: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }>;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<boolean>;
  createOrganization: (name: string) => Promise<boolean>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  organization: null,
  userOrganizations: [],
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setUserOrganizations: (userOrganizations) => set({ userOrganizations }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setIsLoading: (isLoading) => set({ isLoading }),

  login: async (email, password) => {
    try {
      const data = await api.auth.login(email, password) as any;
      if (data.mfa_required && data.user_id) {
        return { mfa_required: true, user_id: data.user_id };
      }
      const { token, user, organization } = data;
      setToken(token);
      set({ user, organization, isAuthenticated: true });
      try {
        const orgs = await api.organizations.list();
        set({ userOrganizations: orgs });
      } catch { /* non bloquant */ }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : undefined };
    }
  },

  loginWithMfa: async (userId, totp) => {
    try {
      const { token, user, organization } = await api.auth.loginMfa(userId, totp);
      setToken(token);
      set({ user, organization, isAuthenticated: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : undefined };
    }
  },

  register: async (data) => {
    try {
      const { token, user, organization } = await api.auth.register(data);
      setToken(token);
      set({ user, organization, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
    }
  },

  loginWithToken: async (token) => {
    try {
      setToken(token);
      const { user, organization } = await api.auth.me();
      set({ user, organization, isAuthenticated: true });
      return true;
    } catch {
      clearToken();
      return false;
    }
  },

  logout: async () => {
    try { await api.auth.logout(); } catch { /* ignore */ }
    clearToken();
    set({
      isAuthenticated: false,
      user: null,
      organization: null,
      userOrganizations: [],
    });
  },

  switchOrganization: async (orgId) => {
    try {
      const { token, user, organization } = await api.organizations.switch(orgId);
      setToken(token);
      set({ user, organization });
      return true;
    } catch {
      return false;
    }
  },

  createOrganization: async (name) => {
    try {
      const { org, role } = await api.organizations.create(name);
      set({ userOrganizations: [...get().userOrganizations, { org, role }] });
      return true;
    } catch {
      return false;
    }
  },

  restoreSession: async () => {
    const token = getToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { user, organization } = await api.auth.me();
      set({ user, organization, isAuthenticated: true });
      try {
        const orgs = await api.organizations.list();
        set({ userOrganizations: orgs });
      } catch { /* non bloquant */ }
    } catch {
      clearToken();
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
