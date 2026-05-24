import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, Bell, Shield, TrendingUp, LogOut,
  ChevronRight, Save, Loader2, RefreshCw, Crown, Star,
  Zap, Search, Calendar, AlertTriangle, Trash2, PauseCircle,
  PlayCircle, BarChart2, Activity, Eye, ArrowLeft, X,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getToken, setToken, clearToken } from '@/lib/api';
import { toast } from 'sonner';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

// ─── Types ───
interface AdminOrg {
  id: string; name: string; plan: string; plan_expires_at: string | null;
  created_at: string; is_suspended: boolean;
  users_count: number; members_count: number; alerts_count: number;
}
interface AdminOrgDetail extends AdminOrg {
  platforms_count: number; subscriptions_count: number;
  recent_audit: { id: string; actor: string; action: string; target_label: string; created_at: string }[];
}
interface AdminUser {
  id: string; full_name: string; email: string; role: string;
  last_login_at: string; created_at: string;
  organization: { id: string; name: string; plan: string };
}
interface AdminStats {
  orgs_count: number; users_count: number; alerts_count: number; members_count: number;
  plans: { free: number; pro: number; enterprise: number };
  growth: { date: string; count: number }[];
}
interface AuditEntry {
  id: string; actor: string; action: string; target_type: string;
  target_label: string; ip_address: string; created_at: string;
  organization: { id: string; name: string };
}
interface PromoCode {
  id: string; code: string; months: number; max_uses: number; uses: number;
  created_at: string; expires_at: string | null;
}

// ─── API helper ───
async function adminReq<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Constants ───
const PLAN_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  free:       { label: 'Free',       color: '#6B7280', icon: Zap   },
  pro:        { label: 'Pro',        color: '#534AB7', icon: Star  },
  enterprise: { label: 'Enterprise', color: '#D97706', icon: Crown },
};
const PLAN_COLORS = ['#6B7280', '#534AB7', '#D97706'];

// ─── Login ───
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await adminReq<{ token: string }>('/admin/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      onLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally { setLoading(false); }
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              autoComplete="username" style={{ background: '#1A1730' }}
              className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]"
              placeholder="admin@tracix.io" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password" style={{ background: '#1A1730' }}
              className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? 'Connexion…' : 'Accéder au panneau admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Edit plan modal ───
function EditPlanModal({ org, onClose, onSaved }: { org: AdminOrg; onClose: () => void; onSaved: (u: AdminOrg) => void }) {
  const [plan, setPlan] = useState(org.plan);
  const [expiresAt, setExpiresAt] = useState(org.plan_expires_at ? org.plan_expires_at.split('T')[0] : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminReq(`/admin/orgs/${org.id}/plan`, {
        method: 'PATCH', body: JSON.stringify({ plan, plan_expires_at: expiresAt || null }),
      });
      onSaved({ ...org, plan, plan_expires_at: expiresAt || null });
      toast.success(`Plan mis à jour → ${plan}`);
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setSaving(false); }
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
              const m = PLAN_META[p]; const Icon = m.icon;
              return (
                <button key={p} onClick={() => setPlan(p)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-all ${plan === p ? 'border-[#534AB7] bg-[#534AB7]/20 text-white' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
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
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            disabled={plan === 'free'} style={{ background: '#0E0C1E' }}
            className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#534AB7] disabled:opacity-30" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-white/60 hover:bg-white/5">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enreg…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ───
function DeleteOrgModal({ org, onClose, onDeleted }: { org: AdminOrg; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminReq(`/admin/orgs/${org.id}`, { method: 'DELETE' });
      toast.success(`Organisation "${org.name}" supprimée`);
      onDeleted();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1A1730] border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Supprimer l'organisation</h3>
            <p className="text-xs text-red-400">Action irréversible — toutes les données seront perdues</p>
          </div>
        </div>
        <p className="text-sm text-white/60">
          Tapez <span className="font-bold text-white">{org.name}</span> pour confirmer la suppression.
        </p>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)}
          style={{ background: '#0E0C1E' }}
          className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
          placeholder={org.name} />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-white/60 hover:bg-white/5">Annuler</button>
          <button onClick={handleDelete} disabled={deleting || confirm !== org.name}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-40 flex items-center justify-center gap-2">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Org detail panel ───
function OrgDetail({ orgId, onBack, onUpdated }: { orgId: string; onBack: () => void; onUpdated: (o: AdminOrg) => void }) {
  const [org, setOrg] = useState<AdminOrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    adminReq<AdminOrgDetail>(`/admin/orgs/${orgId}`)
      .then(setOrg).catch(() => toast.error('Impossible de charger l\'org'))
      .finally(() => setLoading(false));
  }, [orgId]);

  const toggleSuspend = async () => {
    if (!org) return;
    setToggling(true);
    try {
      await adminReq(`/admin/orgs/${org.id}/suspend`, { method: 'PATCH', body: JSON.stringify({ suspended: !org.is_suspended }) });
      const updated = { ...org, is_suspended: !org.is_suspended };
      setOrg(updated);
      onUpdated(updated);
      toast.success(updated.is_suspended ? 'Organisation suspendue' : 'Organisation réactivée');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setToggling(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-white/30" />
    </div>
  );
  if (!org) return null;

  const m = PLAN_META[org.plan] ?? PLAN_META.free;
  const Icon = m.icon;

  return (
    <div className="space-y-5">
      {editPlan && <EditPlanModal org={org} onClose={() => setEditPlan(false)} onSaved={(u) => { setOrg({ ...org, ...u }); onUpdated(u); }} />}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">{org.name}</h2>
          <p className="text-xs text-white/30">Créée le {new Date(org.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleSuspend} disabled={toggling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${org.is_suspended ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'}`}>
            {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : org.is_suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
            {org.is_suspended ? 'Réactiver' : 'Suspendre'}
          </button>
          <button onClick={() => setEditPlan(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#534AB7]/20 text-[#8B82D4] hover:bg-[#534AB7]/30 text-xs font-semibold transition-all">
            <Icon className="w-3.5 h-3.5" />
            Plan {m.label}
          </button>
        </div>
      </div>

      {org.is_suspended && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Cette organisation est suspendue — ses utilisateurs ne peuvent plus se connecter.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Utilisateurs', value: org.users_count, color: '#534AB7' },
          { label: 'Membres', value: org.members_count, color: '#1D9E75' },
          { label: 'Alertes actives', value: org.alerts_count, color: '#E24B4A' },
          { label: 'Plateformes', value: org.platforms_count, color: '#3B82F6' },
          { label: 'Abonnements', value: org.subscriptions_count, color: '#D97706' },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Journal récent */}
      <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <Activity className="w-4 h-4 text-white/40" />
          <p className="text-sm font-semibold text-white/70">Journal d'activité récent</p>
        </div>
        <div className="divide-y divide-white/5">
          {org.recent_audit.length === 0 && (
            <p className="text-center text-sm text-white/25 py-8">Aucune activité</p>
          )}
          {org.recent_audit.map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#534AB7] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-white/60">{e.actor}</span>
                <span className="text-xs text-white/30 mx-1">·</span>
                <span className="text-xs text-white/80 font-medium">{e.action}</span>
                {e.target_label && <span className="text-xs text-white/30 ml-1">— {e.target_label}</span>}
              </div>
              <span className="text-[11px] text-white/25 flex-shrink-0">{new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ───
export function Admin() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'stats' | 'orgs' | 'users' | 'promos' | 'audit'>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editOrg, setEditOrg] = useState<AdminOrg | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<AdminOrg | null>(null);
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  // promo form
  const [promoForm, setPromoForm] = useState({ code: '', months: 1, max_uses: 1, expires_at: '' });
  const [promoSaving, setPromoSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    adminReq<AdminStats>('/admin/stats').then(() => setAuthed(true)).catch(() => clearToken());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o, u, a, p] = await Promise.all([
        adminReq<AdminStats>('/admin/stats'),
        adminReq<AdminOrg[]>('/admin/orgs'),
        adminReq<AdminUser[]>('/admin/users'),
        adminReq<{ total: number; entries: AuditEntry[] }>('/admin/audit?limit=50'),
        adminReq<PromoCode[]>('/admin/promo-codes'),
      ]);
      setStats(s); setOrgs(o); setUsers(u);
      setAuditEntries(a.entries); setAuditTotal(a.total);
      setPromoCodes(p);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur de chargement'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const toggleSuspend = async (org: AdminOrg) => {
    try {
      await adminReq(`/admin/orgs/${org.id}/suspend`, { method: 'PATCH', body: JSON.stringify({ suspended: !org.is_suspended }) });
      setOrgs((prev) => prev.map((o) => o.id === org.id ? { ...o, is_suspended: !org.is_suspended } : o));
      toast.success(!org.is_suspended ? 'Organisation suspendue' : 'Organisation réactivée');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
  };

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const filteredOrgs = orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );


  return (
    <div className="min-h-screen bg-[#0E0C1E] text-white">
      {editOrg && <EditPlanModal org={editOrg} onClose={() => setEditOrg(null)} onSaved={(u) => { setOrgs((p) => p.map((o) => o.id === u.id ? { ...o, ...u } : o)); setEditOrg(null); }} />}
      {deleteOrg && <DeleteOrgModal org={deleteOrg} onClose={() => setDeleteOrg(null)} onDeleted={() => { setOrgs((p) => p.filter((o) => o.id !== deleteOrg.id)); setDeleteOrg(null); }} />}
      {deleteUserId && (() => {
        const u = users.find((x) => x.id === deleteUserId);
        if (!u) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-[#1A1730] border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Supprimer l'utilisateur</h3>
                  <p className="text-xs text-red-400">Cette action est irréversible</p>
                </div>
              </div>
              <p className="text-sm text-white/60">
                Supprimer <span className="font-bold text-white">{u.full_name}</span> ({u.email}) ?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteUserId(null)} className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-white/60 hover:bg-white/5">Annuler</button>
                <button onClick={async () => {
                  try {
                    await adminReq(`/admin/users/${u.id}`, { method: 'DELETE' });
                    setUsers((p) => p.filter((x) => x.id !== u.id));
                    toast.success(`Utilisateur "${u.full_name}" supprimé`);
                  } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
                  finally { setDeleteUserId(null); }
                }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0E0C1E]/95 backdrop-blur z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#534AB7] flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Tracix Admin</p>
            <p className="text-[10px] text-white/30">Panneau super-administrateur</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { clearToken(); setAuthed(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit mb-6 overflow-x-auto">
          {([
            { id: 'stats',  label: 'Statistiques',  icon: BarChart2 },
            { id: 'orgs',   label: 'Organisations', icon: Building2 },
            { id: 'users',  label: 'Utilisateurs',  icon: Users },
            { id: 'promos', label: 'Codes promo',   icon: Zap },
            { id: 'audit',  label: 'Journal global', icon: Activity },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setDetailOrgId(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-[#534AB7] text-white' : 'text-white/40 hover:text-white'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Stats ─── */}
        {tab === 'stats' && stats && (
          <div className="space-y-5">
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Organisations', value: stats.orgs_count,    icon: Building2, color: '#534AB7' },
                { label: 'Utilisateurs',  value: stats.users_count,   icon: Users,     color: '#1D9E75' },
                { label: 'Membres',       value: stats.members_count, icon: Users,     color: '#3B82F6' },
                { label: 'Alertes actives', value: stats.alerts_count, icon: Bell,     color: '#E24B4A' },
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

            {/* Growth chart + Plan pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white/5 border border-white/8 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <p className="text-sm font-semibold text-white/70">Inscriptions — 30 derniers jours</p>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={stats.growth} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#534AB7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#534AB7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#ffffff30', fontSize: 10 }}
                      tickFormatter={(v: string) => v.slice(5)} interval={6} />
                    <YAxis tick={{ fill: '#ffffff30', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1A1730', border: '1px solid #ffffff15', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      labelFormatter={(v: string) => new Date(v).toLocaleDateString('fr-FR')} />
                    <Area type="monotone" dataKey="count" stroke="#534AB7" strokeWidth={2} fill="url(#grad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
                <p className="text-sm font-semibold text-white/70 mb-5">Répartition des plans</p>
                <div className="space-y-4">
                  {(['free', 'pro', 'enterprise'] as const).map((p, i) => {
                    const m = PLAN_META[p];
                    const Icon = m.icon;
                    const count = stats.plans[p] ?? 0;
                    const pct = stats.orgs_count > 0 ? Math.round((count / stats.orgs_count) * 100) : 0;
                    return (
                      <div key={p}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                            <span className="text-xs font-semibold text-white/70">{m.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{count}</span>
                            <span className="text-[11px] text-white/30">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: m.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Orgs ─── */}
        {tab === 'orgs' && (
          detailOrgId
            ? <OrgDetail orgId={detailOrgId} onBack={() => setDetailOrgId(null)}
                onUpdated={(u) => setOrgs((p) => p.map((o) => o.id === u.id ? { ...o, ...u } : o))} />
            : <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher une organisation…" style={{ background: '#1A1730' }}
                      className="w-full border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]" />
                  </div>
                  <span className="text-xs text-white/30 whitespace-nowrap">{filteredOrgs.length} org{filteredOrgs.length > 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-2">
                  {filteredOrgs.map((org) => {
                    const m = PLAN_META[org.plan] ?? PLAN_META.free; const Icon = m.icon;
                    const expiresAt = org.plan_expires_at ? new Date(org.plan_expires_at) : null;
                    const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86400000) : null;
                    return (
                      <div key={org.id} className={`bg-white/5 border rounded-2xl p-4 flex items-center gap-4 transition-colors ${org.is_suspended ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/8 hover:border-white/15'}`}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                          style={{ backgroundColor: `${m.color}25` }}>
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                              style={{ color: m.color, backgroundColor: `${m.color}18` }}>
                              <Icon className="w-3 h-3" />{m.label}
                            </span>
                            {org.is_suspended && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Suspendue</span>
                            )}
                            {daysLeft !== null && daysLeft <= 7 && (
                              <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${daysLeft <= 1 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                <AlertTriangle className="w-3 h-3" />
                                {daysLeft <= 0 ? 'Expiré' : `J-${daysLeft}`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            <span className="text-xs text-white/30">{org.users_count} user{org.users_count > 1 ? 's' : ''}</span>
                            <span className="text-xs text-white/30">{org.members_count} membres</span>
                            <span className="text-xs text-white/30">{org.alerts_count} alertes</span>
                            {expiresAt && (
                              <span className="text-xs text-white/25 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />{expiresAt.toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => setDetailOrgId(org.id)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-all" title="Détails">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditOrg(org)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-[#534AB7] hover:border-[#534AB7]/50 transition-all" title="Modifier le plan">
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toggleSuspend(org)}
                            className={`p-1.5 rounded-lg border transition-all ${org.is_suspended ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-white/10 text-white/40 hover:text-amber-400 hover:border-amber-500/30'}`}
                            title={org.is_suspended ? 'Réactiver' : 'Suspendre'}>
                            {org.is_suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setDeleteOrg(org)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDetailOrgId(org.id)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-all">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur…" style={{ background: '#1A1730' }}
                  className="w-full border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]" />
              </div>
              <span className="text-xs text-white/30 whitespace-nowrap">{filteredUsers.length} user{filteredUsers.length > 1 ? 's' : ''}</span>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Utilisateur</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden sm:table-cell">Organisation</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Rôle</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Dernière connexion</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const orgPlan = PLAN_META[u.organization.plan] ?? PLAN_META.free;
                    const ROLE_COLOR: Record<string, string> = { admin: '#E24B4A', manager: '#EF9F27', editor: '#3B82F6', viewer: '#6B7280' };
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
                            style={{ color: ROLE_COLOR[u.role] ?? '#6B7280', backgroundColor: `${(ROLE_COLOR[u.role] ?? '#6B7280')}18` }}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/30 hidden md:table-cell">
                          {new Date(u.last_login_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setDeleteUserId(u.id)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all"
                            title="Supprimer l'utilisateur">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-sm text-white/25 py-12">Aucun utilisateur trouvé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Codes promo ─── */}
        {tab === 'promos' && (
          <div className="space-y-5">
            {/* Create form */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-sm font-semibold text-white/70 mb-4">Générer un code promo</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Code</label>
                  <input value={promoForm.code} onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="EX: LAUNCH2026" style={{ background: '#0E0C1E' }}
                    className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#534AB7]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Mois offerts</label>
                  <input type="number" min={1} max={24} value={promoForm.months}
                    onChange={(e) => setPromoForm((f) => ({ ...f, months: parseInt(e.target.value) || 1 }))}
                    style={{ background: '#0E0C1E' }}
                    className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#534AB7]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Utilisations max</label>
                  <input type="number" min={1} value={promoForm.max_uses}
                    onChange={(e) => setPromoForm((f) => ({ ...f, max_uses: parseInt(e.target.value) || 1 }))}
                    style={{ background: '#0E0C1E' }}
                    className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#534AB7]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Expire le (optionnel)</label>
                  <input type="date" value={promoForm.expires_at}
                    onChange={(e) => setPromoForm((f) => ({ ...f, expires_at: e.target.value }))}
                    style={{ background: '#0E0C1E' }}
                    className="w-full border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#534AB7]" />
                </div>
              </div>
              <button disabled={promoSaving || !promoForm.code.trim()} onClick={async () => {
                setPromoSaving(true);
                try {
                  const created = await adminReq<PromoCode>('/admin/promo-codes', {
                    method: 'POST',
                    body: JSON.stringify({
                      code: promoForm.code.trim(),
                      months: promoForm.months,
                      max_uses: promoForm.max_uses,
                      expires_at: promoForm.expires_at || null,
                    }),
                  });
                  setPromoCodes((p) => [created, ...p]);
                  setPromoForm({ code: '', months: 1, max_uses: 1, expires_at: '' });
                  toast.success(`Code "${created.code}" créé`);
                } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
                finally { setPromoSaving(false); }
              }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors">
                {promoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {promoSaving ? 'Création…' : 'Créer le code'}
              </button>
            </div>

            {/* List */}
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-sm font-semibold text-white/70">{promoCodes.length} code{promoCodes.length > 1 ? 's' : ''}</p>
              </div>
              {promoCodes.length === 0 && (
                <p className="text-center text-sm text-white/25 py-12">Aucun code promo</p>
              )}
              <div className="divide-y divide-white/5">
                {promoCodes.map((p) => {
                  const expired = p.expires_at && new Date(p.expires_at) < new Date();
                  const exhausted = p.uses >= p.max_uses;
                  return (
                    <div key={p.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/3 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white font-mono tracking-wider">{p.code}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#534AB7]/20 text-[#8B82D4] font-semibold">
                            {p.months} mois
                          </span>
                          {expired && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">Expiré</span>}
                          {!expired && exhausted && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">Épuisé</span>}
                          {!expired && !exhausted && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">Actif</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-white/35">{p.uses}/{p.max_uses} utilisations</span>
                          {p.expires_at && <span className="text-[11px] text-white/25">Expire le {new Date(p.expires_at).toLocaleDateString('fr-FR')}</span>}
                          <span className="text-[11px] text-white/20">Créé le {new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <button onClick={async () => {
                        try {
                          await adminReq(`/admin/promo-codes/${p.id}`, { method: 'DELETE' });
                          setPromoCodes((prev) => prev.filter((x) => x.id !== p.id));
                          toast.success(`Code "${p.code}" supprimé`);
                        } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
                      }} className="p-1.5 rounded-lg border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all flex-shrink-0" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── Audit global ─── */}
        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">{auditTotal.toLocaleString('fr-FR')} entrées au total</p>
              <span className="text-xs text-white/25">50 dernières affichées</span>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
              <div className="divide-y divide-white/5">
                {auditEntries.length === 0 && (
                  <p className="text-center text-sm text-white/25 py-12">Aucune entrée</p>
                )}
                {auditEntries.map((e) => (
                  <div key={e.id} className="px-4 py-3 flex items-start gap-3 hover:bg-white/3 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#534AB7] flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white/80">{e.action}</span>
                        {e.target_label && <span className="text-xs text-white/40">— {e.target_label}</span>}
                        <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-white/40">{e.organization.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-white/30">par {e.actor}</span>
                        {e.ip_address && <span className="text-[11px] text-white/20">{e.ip_address}</span>}
                      </div>
                    </div>
                    <span className="text-[11px] text-white/25 flex-shrink-0">
                      {new Date(e.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
