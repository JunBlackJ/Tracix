import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, Bell, Shield, TrendingUp, LogOut,
  ChevronDown, Save, Loader2, RefreshCw, Crown, Star,
  Zap, Search, Calendar, AlertTriangle,
} from 'lucide-react';
import { getToken, setToken, clearToken } from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ───
interface AdminOrg {
  id: string;
  name: string;
  plan: string;
  plan_expires_at: string | null;
  created_at: string;
  users_count: number;
  members_count: number;
  alerts_count: number;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  last_login_at: string;
  created_at: string;
  organization: { id: string; name: string; plan: string };
}

interface AdminStats {
  orgs_count: number;
  users_count: number;
  alerts_count: number;
  members_count: number;
  plans: { free: number; pro: number; enterprise: number };
}

// ─── API calls ───
async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const PLAN_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  free:       { label: 'Free',       color: '#6B7280', icon: Zap   },
  pro:        { label: 'Pro',        color: '#534AB7', icon: Star  },
  enterprise: { label: 'Enterprise', color: '#D97706', icon: Crown },
};

// ─── Login screen ───
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setToken(data.token!);
      onLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0C1E] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="w-7 h-7 text-[#534AB7]" />
            <span className="text-2xl font-bold text-white">Tracix</span>
          </div>
          <p className="text-sm text-white/40">Panneau d'administration</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]"
              style={{ background: '#1A1730' }}
              placeholder="admin@tracix.io"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]"
              style={{ background: '#1A1730' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? 'Connexion…' : 'Accéder au panneau admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Edit plan modal ───
function EditPlanModal({
  org,
  onClose,
  onSaved,
}: {
  org: AdminOrg;
  onClose: () => void;
  onSaved: (updated: AdminOrg) => void;
}) {
  const [plan, setPlan] = useState(org.plan);
  const [expiresAt, setExpiresAt] = useState(org.plan_expires_at ? org.plan_expires_at.split('T')[0] : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await adminRequest<AdminOrg>(`/admin/orgs/${org.id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan, plan_expires_at: expiresAt || null }),
      });
      onSaved(updated);
      toast.success(`Plan mis à jour → ${plan}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1A1730] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-white">Modifier le plan</h3>
          <p className="text-xs text-white/40 mt-0.5 truncate">{org.name}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2">Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {(['free', 'pro', 'enterprise'] as const).map((p) => {
              const m = PLAN_META[p];
              const Icon = m.icon;
              return (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-all ${
                    plan === p
                      ? 'border-[#534AB7] bg-[#534AB7]/20 text-white'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" style={{ color: plan === p ? m.color : undefined }} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/50 mb-1.5">
            Date d'expiration {plan === 'free' ? '(non applicable)' : ''}
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={plan === 'free'}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#534AB7] disabled:opacity-30"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-white/60 hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enreg…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ───
export function Admin() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'stats' | 'orgs' | 'users'>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editOrg, setEditOrg] = useState<AdminOrg | null>(null);

  // Vérifier si un token super-admin est déjà présent
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    adminRequest<{ orgs_count: number }>('/admin/stats')
      .then(() => setAuthed(true))
      .catch(() => clearToken());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o, u] = await Promise.all([
        adminRequest<AdminStats>('/admin/stats'),
        adminRequest<AdminOrg[]>('/admin/orgs'),
        adminRequest<AdminUser[]>('/admin/users'),
      ]);
      setStats(s);
      setOrgs(o);
      setUsers(u);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const filteredOrgs = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0E0C1E] text-white">
      {editOrg && (
        <EditPlanModal
          org={editOrg}
          onClose={() => setEditOrg(null)}
          onSaved={(updated) => {
            setOrgs((prev) => prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o));
            setEditOrg(null);
          }}
        />
      )}

      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#534AB7] flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Tracix Admin</p>
            <p className="text-[10px] text-white/30">Panneau super-administrateur</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { clearToken(); setAuthed(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit mb-6">
          {([
            { id: 'stats', label: 'Statistiques', icon: TrendingUp },
            { id: 'orgs',  label: 'Organisations', icon: Building2 },
            { id: 'users', label: 'Utilisateurs',  icon: Users },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-[#534AB7] text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Stats ─── */}
        {tab === 'stats' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Organisations', value: stats.orgs_count,    icon: Building2, color: '#534AB7' },
                { label: 'Utilisateurs',  value: stats.users_count,   icon: Users,     color: '#1D9E75' },
                { label: 'Membres',       value: stats.members_count, icon: Users,     color: '#3B82F6' },
                { label: 'Alertes',       value: stats.alerts_count,  icon: Bell,      color: '#E24B4A' },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}20` }}>
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                    </div>
                    <span className="text-xs text-white/40 font-medium">{s.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{s.value.toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-sm font-semibold text-white/70 mb-4">Répartition des plans</p>
              <div className="grid grid-cols-3 gap-4">
                {(['free', 'pro', 'enterprise'] as const).map((p) => {
                  const m = PLAN_META[p];
                  const Icon = m.icon;
                  const count = stats.plans[p] ?? 0;
                  const pct = stats.orgs_count > 0 ? Math.round((count / stats.orgs_count) * 100) : 0;
                  return (
                    <div key={p} className="text-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${m.color}20` }}>
                        <Icon className="w-5 h-5" style={{ color: m.color }} />
                      </div>
                      <p className="text-2xl font-bold text-white">{count}</p>
                      <p className="text-xs text-white/40">{m.label}</p>
                      <p className="text-[11px] text-white/25 mt-0.5">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── Orgs ─── */}
        {tab === 'orgs' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une organisation…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]"
                />
              </div>
              <span className="text-xs text-white/30">{filteredOrgs.length} org{filteredOrgs.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {filteredOrgs.map((org) => {
                const m = PLAN_META[org.plan] ?? PLAN_META.free;
                const Icon = m.icon;
                const expiresAt = org.plan_expires_at ? new Date(org.plan_expires_at) : null;
                const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={org.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-4 hover:border-white/15 transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: `${m.color}25` }}>
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: m.color, backgroundColor: `${m.color}18` }}>
                          <Icon className="w-3 h-3" />
                          {m.label}
                        </span>
                        {daysLeft !== null && daysLeft <= 7 && (
                          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${daysLeft <= 1 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {daysLeft <= 0 ? 'Expiré' : `J-${daysLeft}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-white/30">{org.users_count} user{org.users_count > 1 ? 's' : ''}</span>
                        <span className="text-xs text-white/30">{org.members_count} membres</span>
                        <span className="text-xs text-white/30">{org.alerts_count} alertes</span>
                        {expiresAt && (
                          <span className="text-xs text-white/25 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {expiresAt.toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditOrg(org)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white/50 hover:text-white hover:border-[#534AB7] transition-all flex-shrink-0"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      Plan
                    </button>
                  </div>
                );
              })}
              {filteredOrgs.length === 0 && (
                <p className="text-center text-sm text-white/25 py-12">Aucune organisation trouvée</p>
              )}
            </div>
          </div>
        )}

        {/* ─── Users ─── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]"
                />
              </div>
              <span className="text-xs text-white/30">{filteredUsers.length} user{filteredUsers.length > 1 ? 's' : ''}</span>
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Utilisateur</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden sm:table-cell">Organisation</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Rôle</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Dernière connexion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const orgPlan = PLAN_META[u.organization.plan] ?? PLAN_META.free;
                    const ROLE_COLOR: Record<string, string> = {
                      admin: '#E24B4A', manager: '#EF9F27', editor: '#3B82F6', viewer: '#6B7280',
                    };
                    return (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#534AB7]/30 flex items-center justify-center text-xs font-bold text-[#534AB7] flex-shrink-0">
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{u.full_name}</p>
                              <p className="text-[11px] text-white/35 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/60 truncate max-w-[140px]">{u.organization.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: orgPlan.color, backgroundColor: `${orgPlan.color}18` }}>
                              {orgPlan.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                            style={{ color: ROLE_COLOR[u.role] ?? '#6B7280', backgroundColor: `${ROLE_COLOR[u.role] ?? '#6B7280'}18` }}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/30 hidden md:table-cell">
                          {new Date(u.last_login_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-sm text-white/25 py-12">Aucun utilisateur trouvé</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
