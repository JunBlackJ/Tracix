// ═══════════════════════════════════════════
// Page Paramètres
// ═══════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  User, Building2, Users, Link2, Shield, Save, Bell,
  AlertTriangle, CheckCircle2, Lock, Smartphone, Tag,
  Plus, X, Loader2, TrendingUp, CreditCard, ScrollText,
  FileText, Server as ServerIcon, Network as NetworkIcon,
  ShieldCheck, GitBranch, Import as ImportIcon,
  List, BookOpen, StickyNote, BarChart2, Layers,
  Zap, Star, Crown, Check, ArrowRight, Trash2,
  KeyRound, QrCode, Unlock, Eye, EyeOff,
  Plug, Key, Hash, Copy, RefreshCw, CheckCircle,
} from 'lucide-react';
import type { Connector, WebhookEndpoint, ApiKeyInfo, ApiKeyCreated } from '@/lib/api';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { UserApp, Organization, Category, CategoryType, ModuleId, CustomModule, CustomModuleType } from '@/types';

interface ParametresProps {
  user: UserApp | null;
  organization: Organization | null;
  onThresholdSaved?: () => void;
  categories: Category[];
  customModules: CustomModule[];
  onCategoryAdded: (c: Category) => void;
  onCategoryRemoved: (id: string) => void;
  onOrganizationUpdated: (org: Organization) => void;
  onCustomModuleCreated: (m: CustomModule) => void;
  onCustomModuleRemoved: (id: string) => void;
}

type Section = 'profil' | 'organisation' | 'plan' | 'modules' | 'custom-modules' | 'membres' | 'categories' | 'sso' | 'integrations' | 'connecteurs' | 'api-keys' | 'securite';

export function Parametres({ user, organization, categories, customModules, onCategoryAdded, onCategoryRemoved, onOrganizationUpdated, onCustomModuleCreated, onCustomModuleRemoved, onThresholdSaved }: ParametresProps) {
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState<Section>(() => {
    const s = searchParams.get('section');
    const valid: Section[] = ['profil', 'organisation', 'plan', 'modules', 'custom-modules', 'membres', 'categories', 'sso', 'integrations', 'connecteurs', 'api-keys', 'securite'];
    return (valid.includes(s as Section) ? s : 'profil') as Section;
  });

  const sections: { id: Section; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'profil', label: 'Profil', icon: User },
    { id: 'organisation', label: 'Organisation', icon: Building2 },
    { id: 'plan', label: 'Plan & Facturation', icon: CreditCard, badge: organization?.plan?.toUpperCase() },
    { id: 'modules', label: 'Modules actifs', icon: Shield },
    { id: 'custom-modules', label: 'Mes modules', icon: Tag },
    { id: 'membres', label: 'Membres Tracix', icon: Users },
    { id: 'categories', label: 'Catégories', icon: Tag },
    { id: 'sso', label: 'SSO / SAML', icon: ShieldCheck },
    { id: 'integrations', label: 'Intégrations', icon: Link2 },
    { id: 'connecteurs', label: 'Connecteurs', icon: Plug },
    { id: 'api-keys', label: 'API & SCIM', icon: Key },
    { id: 'securite', label: 'Sécurité', icon: Lock },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez votre compte et votre organisation</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors ${
                  section === s.id
                    ? 'bg-[#534AB7]/10 text-[#534AB7] font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{s.label}</span>
                {s.badge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    s.badge === 'PRO' ? 'bg-[#534AB7] text-white' :
                    s.badge === 'ENTERPRISE' ? 'bg-amber-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>{s.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {section === 'profil' && <ProfilSection user={user} />}
          {section === 'organisation' && <OrganisationSection organization={organization} onUpdated={onOrganizationUpdated} onThresholdSaved={onThresholdSaved} />}
          {section === 'plan' && <PlanSection organization={organization} onUpdated={onOrganizationUpdated} />}
          {section === 'modules' && <ModulesSection organization={organization} onUpdated={onOrganizationUpdated} />}
          {section === 'custom-modules' && (
            <CustomModulesSection
              modules={customModules}
              onCreated={onCustomModuleCreated}
              onRemoved={onCustomModuleRemoved}
            />
          )}
          {section === 'membres' && <MembresSection />}
          {section === 'categories' && (
            <CategoriesSection
              categories={categories}
              onAdded={onCategoryAdded}
              onRemoved={onCategoryRemoved}
            />
          )}
          {section === 'sso' && <SsoSection organization={organization} />}
          {section === 'integrations' && <IntegrationsSection organization={organization} onUpdated={onOrganizationUpdated} />}
          {section === 'connecteurs' && <ConnectorsSection />}
          {section === 'api-keys' && <ApiKeysSection organization={organization} />}
          {section === 'securite' && <SecuriteSection />}
        </div>
      </div>
    </div>
  );
}

function ProfilSection({ user }: { user: UserApp | null }) {
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      await api.auth.updateOrganization({});
      toast.success('Profil mis à jour');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Profil</h2>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-xl font-medium">
          {user.full_name.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-gray-900">{user.full_name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
          <p className="text-xs text-gray-400 capitalize">{user.role}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" defaultValue={user.email} disabled className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400 outline-none cursor-not-allowed" />
          <p className="text-[11px] text-gray-400 mt-0.5">L'email ne peut pas être modifié</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !fullName.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Sauvegarde…' : 'Enregistrer'}
      </button>
    </div>
  );
}

function OrganisationSection({ organization, onUpdated, onThresholdSaved }: { organization: Organization | null; onUpdated: (o: Organization) => void; onThresholdSaved?: () => void }) {
  const [form, setForm] = useState({
    name: organization?.name ?? '',
    max_admin_per_platform: organization?.max_admin_per_platform ?? 3,
    access_review_delay_days: organization?.access_review_delay_days ?? 90,
    subscription_alert_days: organization?.subscription_alert_days ?? 30,
  });
  const [saving, setSaving] = useState(false);

  if (!organization) return null;

  const thresholdFields: (keyof typeof form)[] = ['max_admin_per_platform', 'access_review_delay_days', 'subscription_alert_days'];
  const thresholdChanged = thresholdFields.some((k) => form[k] !== (organization as unknown as Record<string, unknown>)[k]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.auth.updateOrganization(form);
      onUpdated(updated);
      toast.success('Organisation mise à jour');
      if (thresholdChanged && onThresholdSaved) {
        // Laisser ~800ms au serveur pour recalculer les alertes avant de rafraîchir
        setTimeout(() => onThresholdSaved(), 800);
      }
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Organisation</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de l'organisation</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20"
        />
      </div>

      <div className="border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Seuils d'alerte
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Max Admin par plateforme</label>
            <input type="number" value={form.max_admin_per_platform}
              onChange={(e) => setForm((f) => ({ ...f, max_admin_per_platform: +e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Délai revue d'accès (jours)</label>
            <input type="number" value={form.access_review_delay_days}
              onChange={(e) => setForm((f) => ({ ...f, access_review_delay_days: +e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Alerte abonnement (jours)</label>
            <input type="number" value={form.subscription_alert_days}
              onChange={(e) => setForm((f) => ({ ...f, subscription_alert_days: +e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer
      </button>
    </div>
  );
}

// ─── Modules actifs ───

const ALL_MODULES: { id: ModuleId; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'habilitations',  label: 'Habilitations',   desc: 'Matrice membres × plateformes, gestion des droits', icon: GitBranch },
  { id: 'membres',        label: 'Membres',          desc: 'Annuaire des membres et fiches détaillées',         icon: Users },
  { id: 'plateformes',    label: 'Plateformes',      desc: 'Inventaire des outils et services de l\'entreprise', icon: ShieldCheck },
  { id: 'score-de-risque',label: 'Score de risque',  desc: 'Analyse des risques par membre et par plateforme',  icon: TrendingUp },
  { id: 'systemes',       label: 'Systèmes',         desc: 'Inventaire des serveurs, machines et équipements',  icon: ServerIcon },
  { id: 'flux-reseau',    label: 'Flux réseau',      desc: 'Cartographie des flux et règles de firewall',       icon: NetworkIcon },
  { id: 'abonnements',    label: 'Abonnements',      desc: 'Suivi des licences, SaaS et renouvellements',       icon: CreditCard },
  { id: 'alertes',        label: 'Alertes',          desc: 'Notifications de risques et anomalies détectées',   icon: Bell },
  { id: 'journal',        label: "Journal d'audit",  desc: 'Historique de toutes les actions effectuées',       icon: ScrollText },
  { id: 'rapports',       label: 'Rapports',         desc: 'Export PDF/XLSX pour audits et conformité',         icon: FileText },
  { id: 'import',         label: 'Import',           desc: 'Import de données via CSV ou JSON',                 icon: ImportIcon },
];

function ModulesSection({ organization, onUpdated }: { organization: Organization | null; onUpdated: (o: Organization) => void }) {
  const [enabled, setEnabled] = useState<Set<ModuleId>>(
    new Set(organization?.enabled_modules ?? ALL_MODULES.map((m) => m.id))
  );
  const [saving, setSaving] = useState(false);

  if (!organization) return null;

  const toggle = (id: ModuleId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.auth.updateOrganization({ enabled_modules: Array.from(enabled) });
      onUpdated(updated);
      toast.success('Modules mis à jour — la navigation a été actualisée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Modules actifs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Activez uniquement les modules dont votre organisation a besoin. Les modules désactivés disparaissent de la navigation.
        </p>
      </div>

      <div className="space-y-2">
        {ALL_MODULES.map((mod) => {
          const isOn = enabled.has(mod.id);
          return (
            <div
              key={mod.id}
              onClick={() => toggle(mod.id)}
              className={`flex items-center gap-4 p-3.5 rounded-xl border cursor-pointer transition-all ${
                isOn ? 'border-[#534AB7]/30 bg-[#534AB7]/5' : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-[#534AB7]/10' : 'bg-gray-100'}`}>
                <mod.icon className={`w-4 h-4 ${isOn ? 'text-[#534AB7]' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isOn ? 'text-gray-900' : 'text-gray-400'}`}>{mod.label}</p>
                <p className="text-xs text-gray-400 truncate">{mod.desc}</p>
              </div>
              {/* Toggle visuel */}
              <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${isOn ? 'bg-[#534AB7]' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">{enabled.size} module{enabled.size > 1 ? 's' : ''} activé{enabled.size > 1 ? 's' : ''}</p>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function MembresSection() {
  const [invitations, setInvitations] = useState<{ id: string; email: string | null; role: string; token: string; expires_at: string; accepted_at: string | null; invite_url: string }[]>([]);
  const [planInfo, setPlanInfo] = useState<{ seats: number; seats_used: number; invitationsEnabled: boolean; plan: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState<'viewer' | 'editor'>('viewer');
  const [newEmail, setNewEmail] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([api.invitations.list(), api.plan.limits()])
      .then(([invs, pl]) => {
        setInvitations(invs);
        setPlanInfo({
          seats: pl.limits.seats,
          seats_used: pl.usage.seats,
          invitationsEnabled: pl.limits.invitationsEnabled,
          plan: pl.plan,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const inv = await api.invitations.create(newRole, newEmail || undefined);
      setInvitations((prev) => [{ ...inv, email: newEmail || null, accepted_at: null }, ...prev]);
      setNewEmail('');
      setShowForm(false);
      toast.success('Invitation créée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await api.invitations.revoke(id);
      setInvitations((prev) => prev.filter((i) => i.id !== id));
      toast.success('Invitation révoquée');
    } catch {
      toast.error('Erreur lors de la révocation');
    }
  };

  const copyLink = (inv: typeof invitations[0]) => {
    const url = inv.invite_url ?? `${window.location.origin}/rejoindre/${inv.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const ROLE_LABEL: Record<string, { label: string; color: string }> = {
    viewer: { label: 'Lecteur', color: 'bg-blue-100 text-blue-700' },
    editor: { label: 'Éditeur', color: 'bg-amber-100 text-amber-700' },
    admin:  { label: 'Admin',   color: 'bg-red-100 text-red-700' },
  };

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#534AB7]" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Membres Tracix</h2>
          {planInfo && planInfo.seats !== -1 && (
            <span className="text-xs text-gray-400">{planInfo.seats_used} / {planInfo.seats} sièges</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-5">Invitez des collaborateurs à accéder à votre espace Tracix.</p>

        {/* Tableau des rôles */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { role: 'Lecteur', desc: 'Consulte toutes les données, ne peut pas modifier', icon: '👁️', color: 'bg-blue-50 border-blue-200' },
            { role: 'Éditeur', desc: 'Lit et modifie les données (membres, accès, alertes…)', icon: '✏️', color: 'bg-amber-50 border-amber-200' },
          ].map((r) => (
            <div key={r.role} className={`p-3 rounded-xl border ${r.color}`}>
              <p className="text-sm font-semibold text-gray-800">{r.icon} {r.role}</p>
              <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
            </div>
          ))}
        </div>

        {/* Bouton invitation — toujours visible */}
        {!showForm ? (
          planInfo?.invitationsEnabled ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#534AB7]/40 text-[#534AB7] text-sm font-medium hover:bg-[#534AB7]/5 transition-colors mb-5">
              <Plus className="w-4 h-4" />
              Créer un lien d'invitation
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Invitations — Plan Pro requis</p>
                <p className="text-xs text-amber-600 mt-0.5">Passez à Pro pour inviter des collaborateurs en lecture ou en modification.</p>
              </div>
              <button
                onClick={() => toast.info('Passez à Pro dans Paramètres → Plan & Facturation')}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">
                Passer à Pro
              </button>
            </div>
          )
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 mb-5">
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'viewer' | 'editor')}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:border-[#534AB7] outline-none">
              <option value="viewer">Lecteur</option>
              <option value="editor">Éditeur</option>
            </select>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email (optionnel)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:border-[#534AB7] outline-none" />
            <button type="submit" disabled={creating}
              className="px-4 py-2 rounded-lg bg-[#534AB7] text-white text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60 flex items-center gap-1.5">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
              Annuler
            </button>
          </form>
        )}

        {/* Liste des invitations */}
        {invitations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune invitation créée pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const used = !!inv.accepted_at;
              const r = ROLE_LABEL[inv.role] ?? { label: inv.role, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
                      {inv.email && <span className="text-xs text-gray-500 truncate">{inv.email}</span>}
                      {used && <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Acceptée</span>}
                      {!used && expired && <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Expirée</span>}
                      {!used && !expired && <span className="text-[11px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">En attente</span>}
                    </div>
                    {!used && !expired && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!used && !expired && (
                      <button onClick={() => copyLink(inv)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#534AB7]/30 text-[#534AB7] text-xs font-medium hover:bg-[#534AB7]/5 transition-colors">
                        {copiedId === inv.id ? <><CheckCircle2 className="w-3.5 h-3.5" />Copié !</> : <><Link2 className="w-3.5 h-3.5" />Copier le lien</>}
                      </button>
                    )}
                    <button onClick={() => handleRevoke(inv.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SsoSection({ organization }: { organization: Organization | null }) {
  const [cfg, setCfg] = useState<{
    configured: boolean;
    entity_id?: string;
    sso_url?: string;
    certificate?: string;
    is_enabled?: boolean;
    metadata_url?: string;
    login_url?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ entity_id: '', sso_url: '', certificate: '', is_enabled: true });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.saml.getConfig()
      .then((data) => {
        setCfg(data);
        if (data.configured) {
          setForm({
            entity_id: data.entity_id ?? '',
            sso_url: data.sso_url ?? '',
            certificate: data.certificate ?? '',
            is_enabled: data.is_enabled ?? true,
          });
        }
      })
      .catch(() => setCfg({ configured: false }))
      .finally(() => setLoading(false));
  }, []);

  const isEnterprise = organization?.plan === 'enterprise';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entity_id || !form.sso_url || !form.certificate) {
      toast.error('Tous les champs sont requis');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.saml.saveConfig(form);
      setCfg({ ...updated, configured: true });
      setShowForm(false);
      toast.success('Configuration SSO enregistrée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.saml.deleteConfig();
      setCfg({ configured: false });
      setForm({ entity_id: '', sso_url: '', certificate: '', is_enabled: true });
      setShowForm(false);
      toast.success('Configuration SSO supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#534AB7]" />
      </div>
    );
  }

  if (!isEnterprise) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#534AB7]" />
          SSO / SAML
        </h2>
        <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Plan Enterprise requis</p>
            <p className="text-xs text-amber-600 mt-1">
              L'authentification SSO/SAML 2.0 est disponible uniquement pour les organisations Enterprise.
              Elle permet à vos utilisateurs de se connecter via votre IdP (Okta, Azure AD, Google Workspace, etc.)
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {['Okta', 'Azure AD', 'Google Workspace'].map((idp) => (
            <div key={idp} className="p-3 rounded-xl border border-gray-200 text-center opacity-50">
              <p className="text-xs font-semibold text-gray-600">{idp}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Compatible SAML 2.0</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#534AB7]" />
              SSO / SAML 2.0
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connectez votre fournisseur d'identité (Okta, Azure AD, Google Workspace…)
            </p>
          </div>
          {cfg?.configured && (
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.is_enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {cfg.is_enabled ? 'Actif' : 'Désactivé'}
            </span>
          )}
        </div>

        {/* Config info or setup prompt */}
        {!cfg?.configured && !showForm ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-[#534AB7]/8 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-[#534AB7]/50" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Aucun fournisseur SSO configuré</p>
            <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
              Connectez Okta, Azure AD, Ping Identity ou tout autre IdP compatible SAML 2.0.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Configurer le SSO
            </button>
          </div>
        ) : cfg?.configured && !showForm ? (
          <div className="space-y-3">
            {/* URLs info */}
            {[
              { label: 'URL de connexion SSO', value: cfg.login_url ?? '', key: 'login' },
              { label: 'URL de métadonnées SP', value: cfg.metadata_url ?? '', key: 'meta' },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-500 mb-0.5">{row.label}</p>
                  <p className="text-xs text-gray-700 font-mono truncate">{row.value}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(row.value, row.key)}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-[#534AB7]"
                >
                  {copied === row.key
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Link2 className="w-4 h-4" />}
                </button>
              </div>
            ))}

            {/* IdP info */}
            <div className="p-4 rounded-xl border border-gray-200 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Configuration IdP enregistrée</p>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="flex gap-2 text-xs">
                  <span className="text-gray-400 w-24 flex-shrink-0">Entity ID</span>
                  <span className="text-gray-700 font-mono truncate">{cfg.entity_id}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-gray-400 w-24 flex-shrink-0">SSO URL</span>
                  <span className="text-gray-700 font-mono truncate">{cfg.sso_url}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-gray-400 w-24 flex-shrink-0">Certificat</span>
                  <span className="text-gray-500">••••••••••••{cfg.certificate?.slice(-8)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Modifier
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Supprimer
              </button>
            </div>
          </div>
        ) : null}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <p className="font-semibold mb-1">Configuration SAML 2.0</p>
              <p>Récupérez ces informations depuis votre fournisseur d'identité (IdP). L'URL de callback à enregistrer côté IdP est :</p>
              <p className="font-mono mt-1 bg-white/60 px-2 py-1 rounded text-blue-800 break-all">
                {`${import.meta.env.VITE_API_URL ?? ''}/saml/${organization?.id}/callback`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Entity ID (Issuer) *</label>
              <input
                type="text"
                value={form.entity_id}
                onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                placeholder="https://your-idp.example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">SSO URL (Login endpoint) *</label>
              <input
                type="url"
                value={form.sso_url}
                onChange={(e) => setForm((f) => ({ ...f, sso_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                placeholder="https://your-idp.example.com/sso/saml"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Certificat X.509 (base64) *</label>
              <textarea
                value={form.certificate}
                onChange={(e) => setForm((f) => ({ ...f, certificate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 font-mono h-28 resize-none"
                placeholder={"-----BEGIN CERTIFICATE-----\nMIIC....\n-----END CERTIFICATE-----"}
                required
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Collez le certificat avec ou sans les lignes BEGIN/END CERTIFICATE</p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, is_enabled: !f.is_enabled }))}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${form.is_enabled ? 'bg-[#534AB7]' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm text-gray-700">Activer le SSO pour cette organisation</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Compatible IdPs */}
      {!showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Fournisseurs d'identité compatibles</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { name: 'Okta', desc: 'Enterprise Identity' },
              { name: 'Azure AD', desc: 'Microsoft Entra ID' },
              { name: 'Google Workspace', desc: 'G Suite / Workspace' },
              { name: 'Ping Identity', desc: 'PingFederate' },
              { name: 'OneLogin', desc: 'OneLogin SSO' },
              { name: 'ADFS', desc: 'Active Directory FS' },
            ].map((idp) => (
              <div key={idp.name} className="p-3 rounded-xl border border-gray-200 hover:border-[#534AB7]/30 hover:bg-[#534AB7]/3 transition-colors">
                <p className="text-xs font-semibold text-gray-700">{idp.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{idp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsSection({ organization, onUpdated }: { organization: Organization | null; onUpdated: (o: Organization) => void }) {
  const [enabled, setEnabled] = useState(organization?.alert_email_enabled ?? false);
  const [address, setAddress] = useState(organization?.alert_email_address ?? '');
  const [frequency, setFrequency] = useState<'immediate' | 'daily'>(organization?.alert_email_frequency ?? 'daily');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.auth.updateOrganization({
        alert_email_enabled: enabled,
        alert_email_address: address.trim(),
        alert_email_frequency: frequency,
      });
      onUpdated(updated);
      toast.success('Préférences email enregistrées');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!address.trim()) { toast.error('Renseignez une adresse email d\'abord'); return; }
    setTesting(true);
    try {
      const res = await api.auth.testEmail();
      toast.success(`Email de test envoyé à ${res.sent_to}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#534AB7]" />
            Notifications email
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Recevez les alertes critiques et les rappels d'abonnements par email.
          </p>
        </div>

        {/* Toggle activer */}
        <div
          onClick={() => setEnabled((v) => !v)}
          className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
            enabled ? 'border-[#534AB7]/30 bg-[#534AB7]/5' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${enabled ? 'bg-[#534AB7]/10' : 'bg-gray-100'}`}>
              <Bell className={`w-4 h-4 ${enabled ? 'text-[#534AB7]' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>Activer les alertes email</p>
              <p className="text-xs text-gray-400">Alertes critiques + rappels abonnements</p>
            </div>
          </div>
          <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${enabled ? 'bg-[#534AB7]' : 'bg-gray-300'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </div>

        {/* Adresse email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Adresse email de réception
          </label>
          <input
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="responsable-it@votreentreprise.com"
            disabled={!enabled}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {/* Fréquence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Fréquence</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'immediate', label: 'Immédiat', desc: 'Dès qu\'une alerte est détectée' },
              { value: 'daily',     label: 'Quotidien', desc: 'Résumé chaque matin à 8h' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={!enabled}
                onClick={() => setFrequency(opt.value)}
                className={`text-left p-3 rounded-xl border transition-all disabled:opacity-40 ${
                  frequency === opt.value
                    ? 'border-[#534AB7] bg-[#534AB7]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${frequency === opt.value ? 'text-[#534AB7]' : 'text-gray-700'}`}>{opt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Ce que Tracix envoie */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ce que vous recevez</p>
          <div className="space-y-2">
            {[
              { label: 'Alertes critiques & warnings', desc: 'Admin sans MFA, départ non traité, compte partagé…', color: 'text-red-600', dot: 'bg-red-500' },
              { label: 'Rappels abonnements', desc: 'J-30, J-14, J-7 et J-1 avant renouvellement', color: 'text-amber-600', dot: 'bg-amber-500' },
              { label: 'Fins de support système', desc: 'Systèmes avec date de fin de support proche', color: 'text-[#534AB7]', dot: 'bg-[#534AB7]' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${item.dot}`} />
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Boutons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !enabled || !address.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {testing ? 'Envoi…' : 'Tester'}
          </button>
        </div>
      </div>

      {/* Webhooks */}
      <WebhooksSubSection />
    </div>
  );
}

// ─── Webhooks sub-section (used inside IntegrationsSection) ───

const WEBHOOK_PROVIDERS: { value: string; label: string; bg: string; icon: React.ElementType }[] = [
  { value: 'slack',      label: 'Slack',      bg: '#4A154B', icon: Hash },
  { value: 'teams',      label: 'Teams',      bg: '#5264AB', icon: Hash },
  { value: 'discord',    label: 'Discord',    bg: '#5865F2', icon: Hash },
  { value: 'pagerduty',  label: 'PagerDuty',  bg: '#25C151', icon: Hash },
  { value: 'custom',     label: 'Custom',     bg: '#6B7280', icon: Hash },
];

const WEBHOOK_EVENTS: { value: string; label: string }[] = [
  { value: 'alert.critical', label: 'Alertes critiques & high' },
  { value: 'alert.all',      label: 'Toutes les alertes' },
];

function WebhooksSubSection() {
  const [webhooks, setWebhooks]     = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState<string | null>(null);
  const [removing, setRemoving]     = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    provider: 'slack',
    url: '',
    events: ['alert.critical'] as string[],
    active: true,
  });

  useEffect(() => {
    api.webhooks.list()
      .then(setWebhooks)
      .catch(() => {/* silently ignore — endpoint may not exist yet */})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) { toast.error('Nom et URL requis'); return; }
    if (form.events.length === 0) { toast.error('Sélectionnez au moins un événement'); return; }
    setSaving(true);
    try {
      const created = await api.webhooks.create(form);
      setWebhooks((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ name: '', provider: 'slack', url: '', events: ['alert.critical'], active: true });
      toast.success('Webhook créé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur création webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await api.webhooks.test(id);
      toast.success(`Test envoyé — HTTP ${res.status_code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du test');
    } finally {
      setTesting(null);
    }
  };

  const handleToggle = async (hook: WebhookEndpoint) => {
    try {
      const updated = await api.webhooks.update(hook.id, { active: !hook.active });
      setWebhooks((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    } catch {
      toast.error('Erreur mise à jour webhook');
    }
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      await api.webhooks.remove(id);
      setWebhooks((prev) => prev.filter((h) => h.id !== id));
      toast.success('Webhook supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur suppression');
    } finally {
      setRemoving(null);
    }
  };

  const copySecret = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopiedSecret(id);
      setTimeout(() => setCopiedSecret(null), 2000);
    });
  };

  const providerMeta = (p: string) => WEBHOOK_PROVIDERS.find((x) => x.value === p) ?? WEBHOOK_PROVIDERS[WEBHOOK_PROVIDERS.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#534AB7]" />
            Webhooks
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Envoyez les alertes vers vos outils externes.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#534AB7] text-white rounded-lg text-xs font-medium hover:bg-[#3C3489] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="border border-[#534AB7]/20 rounded-xl p-4 bg-[#534AB7]/3 mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Nouveau webhook</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ex: Alertes Slack IT"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            >
              {WEBHOOK_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Événements</label>
            <div className="space-y-1.5">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm((f) => ({ ...f, events: [...f.events, ev.value] }));
                      } else {
                        setForm((f) => ({ ...f, events: f.events.filter((x) => x !== ev.value) }));
                      }
                    }}
                    className="w-3.5 h-3.5 accent-[#534AB7]"
                  />
                  <span className="text-sm text-gray-700">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ name: '', provider: 'slack', url: '', events: ['alert.critical'], active: true }); }}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Aucun webhook configuré
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((hook) => {
            const meta = providerMeta(hook.provider);
            return (
              <div key={hook.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: meta.bg + '22' }}
                    >
                      <meta.icon className="w-4 h-4" style={{ color: meta.bg }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{hook.name}</p>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: meta.bg }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate max-w-xs">{hook.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle actif */}
                    <button
                      onClick={() => handleToggle(hook)}
                      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${hook.active ? 'bg-[#534AB7]' : 'bg-gray-300'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${hook.active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-1.5">
                  {hook.events.map((ev) => (
                    <span key={ev} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {WEBHOOK_EVENTS.find((e) => e.value === ev)?.label ?? ev}
                    </span>
                  ))}
                </div>

                {/* Signing secret */}
                {hook.signing_secret && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Secret :</span>
                    <span className="font-mono bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                      {hook.signing_secret.slice(0, 8)}••••••••
                    </span>
                    <button
                      onClick={() => copySecret(hook.id, hook.signing_secret)}
                      className="p-0.5 text-gray-400 hover:text-[#534AB7] transition-colors"
                    >
                      {copiedSecret === hook.id
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                )}

                {/* Last triggered */}
                {hook.last_triggered_at && (
                  <p className="text-xs text-gray-400">
                    Dernier déclenchement : {new Date(hook.last_triggered_at).toLocaleString('fr-FR')}
                    {hook.last_status_code != null && (
                      <span className={`ml-1.5 font-medium ${hook.last_status_code < 400 ? 'text-emerald-600' : 'text-red-500'}`}>
                        HTTP {hook.last_status_code}
                      </span>
                    )}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleTest(hook.id)}
                    disabled={testing === hook.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {testing === hook.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Tester
                  </button>
                  <button
                    onClick={() => handleRemove(hook.id)}
                    disabled={removing === hook.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-100 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {removing === hook.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Connecteurs ───

const CONNECTOR_PROVIDERS: {
  value: string;
  label: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}[] = [
  {
    value: 'github',
    label: 'GitHub',
    fields: [
      { key: 'org',   label: 'Organisation GitHub',  placeholder: 'my-org' },
      { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_...', secret: true },
    ],
  },
  {
    value: 'okta',
    label: 'Okta',
    fields: [
      { key: 'domain', label: 'Domaine Okta',  placeholder: 'company.okta.com' },
      { key: 'token',  label: 'API Token',      placeholder: 'SSWS ...', secret: true },
    ],
  },
  {
    value: 'microsoft_graph',
    label: 'Microsoft Graph',
    fields: [
      { key: 'tenant_id',     label: 'Tenant ID',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx' },
      { key: 'client_id',     label: 'Client ID',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx' },
      { key: 'client_secret', label: 'Client Secret', placeholder: '••••••••', secret: true },
    ],
  },
  {
    value: 'google_workspace',
    label: 'Google Workspace',
    fields: [
      { key: 'domain',       label: 'Domaine',       placeholder: 'company.com' },
      { key: 'access_token', label: 'Access Token',  placeholder: '••••••••', secret: true },
    ],
  },
];

function ConnectorsSection() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading]       = useState(true);
  const [openForm, setOpenForm]     = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [syncing, setSyncing]       = useState<string | null>(null);
  const [removing, setRemoving]     = useState<string | null>(null);

  useEffect(() => {
    api.connectors.list()
      .then(setConnectors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectorFor = (provider: string) =>
    connectors.find((c) => c.provider === provider);

  const openConfigure = (provider: string) => {
    const existing = connectorFor(provider);
    const meta = CONNECTOR_PROVIDERS.find((p) => p.value === provider)!;
    const defaultConfig: Record<string, string> = {};
    meta.fields.forEach((f) => { defaultConfig[f.key] = existing?.config[f.key] ?? ''; });
    setFormConfig(defaultConfig);
    setOpenForm(provider);
  };

  const handleSave = async (provider: string) => {
    setSaving(true);
    try {
      const result = await api.connectors.upsert({ provider, config: formConfig, enabled: true });
      setConnectors((prev) => {
        const idx = prev.findIndex((c) => c.provider === provider);
        return idx >= 0 ? prev.map((c, i) => (i === idx ? result : c)) : [result, ...prev];
      });
      setOpenForm(null);
      toast.success('Connecteur configuré');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      await api.connectors.sync(id);
      toast.success('Synchronisation lancée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur synchronisation');
    } finally {
      setSyncing(null);
    }
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      await api.connectors.remove(id);
      setConnectors((prev) => prev.filter((c) => c.id !== id));
      toast.success('Connecteur supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur suppression');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Plug className="w-5 h-5 text-[#534AB7]" />
            Connecteurs
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Synchronisez automatiquement vos membres depuis vos outils d'identité.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {CONNECTOR_PROVIDERS.map((meta) => {
              const connector = connectorFor(meta.value);
              const isConfigured = !!connector;
              const isFormOpen = openForm === meta.value;

              return (
                <div key={meta.value} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Plug className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            isConfigured
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isConfigured ? 'Configuré' : 'Non configuré'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isConfigured && (
                        <>
                          <button
                            onClick={() => handleSync(connector.id)}
                            disabled={syncing === connector.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            {syncing === connector.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RefreshCw className="w-3 h-3" />
                            }
                            Sync
                          </button>
                          <button
                            onClick={() => handleRemove(connector.id)}
                            disabled={removing === connector.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-red-100 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {removing === connector.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Supprimer
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => isFormOpen ? setOpenForm(null) : openConfigure(meta.value)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#534AB7] text-white rounded-lg text-xs font-medium hover:bg-[#3C3489] transition-colors"
                      >
                        {isFormOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {isFormOpen ? 'Annuler' : 'Configurer'}
                      </button>
                    </div>
                  </div>

                  {/* Sync info */}
                  {isConfigured && !isFormOpen && (
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t border-gray-100 pt-3">
                      <span>
                        Dernière sync :{' '}
                        {connector.last_sync_at
                          ? new Date(connector.last_sync_at).toLocaleString('fr-FR')
                          : 'jamais'}
                      </span>
                      <span>{connector.synced_count} membres synchronisés</span>
                      {connector.last_sync_status === 'success' && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle className="w-3 h-3" /> Succès
                        </span>
                      )}
                      {connector.last_sync_status === 'error' && (
                        <span className="flex items-center gap-1 text-red-500 font-medium">
                          <X className="w-3 h-3" /> Erreur
                          {connector.last_sync_error && ` — ${connector.last_sync_error}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Form */}
                  {isFormOpen && (
                    <div className="border-t border-gray-100 pt-3 space-y-3">
                      {meta.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                          <input
                            type={field.secret ? 'password' : 'text'}
                            value={formConfig[field.key] ?? ''}
                            onChange={(e) => setFormConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => handleSave(meta.value)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60 transition-colors"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Keys & SCIM ───

const ALL_SCOPES = [
  { value: 'read',  label: 'Lecture' },
  { value: 'write', label: 'Écriture' },
  { value: 'scim',  label: 'SCIM' },
];

function ApiKeysSection({ organization }: { organization: Organization | null }) {
  const [keys, setKeys]           = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [revoking, setRevoking]   = useState<string | null>(null);
  const [newKey, setNewKey]       = useState<ApiKeyCreated | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [form, setForm] = useState<{ name: string; scopes: string[]; expires_at: string }>({
    name: '',
    scopes: ['read'],
    expires_at: '',
  });

  const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api$/, '');

  useEffect(() => {
    api.apiKeys.list()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    if (form.scopes.length === 0) { toast.error('Sélectionnez au moins un scope'); return; }
    setSaving(true);
    try {
      const created = await api.apiKeys.create({
        name: form.name.trim(),
        scopes: form.scopes,
        ...(form.expires_at ? { expires_at: form.expires_at } : {}),
      });
      setKeys((prev) => [created, ...prev]);
      setNewKey(created);
      setShowForm(false);
      setForm({ name: '', scopes: ['read'], expires_at: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur création clé');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.apiKeys.revoke(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success('Clé révoquée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur révocation');
    } finally {
      setRevoking(null);
    }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.key).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Banner nouvelle clé */}
      {newKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Copiez cette clé maintenant — elle ne sera plus affichée</p>
              <p className="text-xs text-amber-600 mt-0.5">Après fermeture de cette bannière, la clé complète ne sera plus récupérable.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 min-w-0 text-xs font-mono bg-white border border-amber-200 rounded px-2.5 py-1.5 text-amber-900 break-all">
                  {newKey.key}
                </code>
                <button
                  onClick={copyKey}
                  className="flex-shrink-0 p-1.5 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  {copiedKey
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <Copy className="w-4 h-4 text-amber-600" />
                  }
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-amber-600 hover:text-amber-700 underline"
          >
            J'ai copié ma clé, fermer
          </button>
        </div>
      )}

      {/* Clés API */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#534AB7]" />
              Clés API
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Gérez les accès programmatiques à l'API Tracix.</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#534AB7] text-white rounded-lg text-xs font-medium hover:bg-[#3C3489] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Créer
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleCreate} className="border border-[#534AB7]/20 rounded-xl p-4 bg-[#534AB7]/3 mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Nouvelle clé API</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex: CI/CD Pipeline"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Scopes</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.scopes.includes(s.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm((f) => ({ ...f, scopes: [...f.scopes, s.value] }));
                        } else {
                          setForm((f) => ({ ...f, scopes: f.scopes.filter((x) => x !== s.value) }));
                        }
                      }}
                      className="w-3.5 h-3.5 accent-[#534AB7]"
                    />
                    <span className="text-sm text-gray-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expiration (optionnel)</label>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm({ name: '', scopes: ['read'], expires_at: '' }); }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                {saving ? 'Création…' : 'Créer la clé'}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Aucune clé API créée
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{k.name}</p>
                    <code className="text-xs bg-gray-100 text-gray-600 font-mono px-2 py-0.5 rounded">
                      {k.key_prefix}•••
                    </code>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {k.scopes.map((sc) => (
                      <span key={sc} className="text-[10px] bg-[#534AB7]/10 text-[#534AB7] px-1.5 py-0.5 rounded-full font-medium">
                        {sc}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>Créée : {new Date(k.created_at).toLocaleDateString('fr-FR')}</span>
                    {k.last_used_at && (
                      <span>Utilisée : {new Date(k.last_used_at).toLocaleDateString('fr-FR')}</span>
                    )}
                    {k.expires_at && (
                      <span>Expire : {new Date(k.expires_at).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  disabled={revoking === k.id}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-100 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {revoking === k.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Révoquer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SCIM Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#534AB7]" />
            Endpoint SCIM 2.0
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Provisionnez automatiquement les utilisateurs depuis votre IdP.</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Base URL</p>
              <p className="text-xs text-gray-700 font-mono truncate">{apiBaseUrl}/api/scim/v2</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Authentification</p>
              <p className="text-xs text-gray-700">Bearer Token — clé API avec scope <code className="bg-gray-200 px-1 rounded font-mono">scim</code></p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Ressources supportées</p>
              <p className="text-xs text-gray-700">Users — create, read, update, deactivate</p>
            </div>
          </div>
          {organization?.id && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Organisation ID</p>
                <p className="text-xs text-gray-700 font-mono truncate">{organization.id}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modules personnalisés ───

const MODULE_TYPES: { value: CustomModuleType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'liste',       label: 'Liste de tâches',         desc: 'Tâches, actions, suivi de projet',        icon: List },
  { value: 'contacts',    label: 'Annuaire de contacts',    desc: 'Fournisseurs, partenaires, équipes',      icon: Users },
  { value: 'documents',   label: 'Bibliothèque documents',  desc: 'Contrats, politiques, rapports',          icon: FileText },
  { value: 'procedures',  label: 'Procédures',              desc: 'Processus métier, guides opérationnels',  icon: BookOpen },
  { value: 'notes',       label: 'Notes libres',            desc: 'Wiki interne, réunions, décisions',       icon: StickyNote },
  { value: 'kpis',        label: 'Indicateurs KPIs',        desc: 'Métriques, tableaux de bord, objectifs',  icon: BarChart2 },
];

const ICON_OPTIONS = [
  'Layers', 'Briefcase', 'Globe', 'Map', 'Package', 'Star', 'Flag',
  'Database', 'Cloud', 'Code', 'Cpu', 'HardDrive', 'Monitor',
  'Calendar', 'Clock', 'MessageSquare', 'Mail', 'Phone',
  'Lock', 'Key', 'Eye', 'CheckCircle',
];

const COLOR_OPTIONS = [
  '#534AB7', '#1D9E75', '#E24B4A', '#EF9F27', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6B7280',
];

interface CustomModulesSectionProps {
  modules: CustomModule[];
  onCreated: (m: CustomModule) => void;
  onRemoved: (id: string) => void;
}

function CustomModulesSection({ modules, onCreated, onRemoved }: CustomModulesSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; module_type: CustomModuleType; icon: string; color: string }>({
    title: '', description: '', module_type: 'liste', icon: 'Layers', color: '#534AB7',
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Le titre est requis'); return; }
    setSaving(true);
    try {
      const created = await api.customModules.create({ ...form, nav_order: modules.length });
      onCreated(created);
      setForm({ title: '', description: '', module_type: 'liste', icon: 'Layers', color: '#534AB7' });
      setShowCreate(false);
      toast.success(`Module "${created.title}" créé`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: CustomModule) => {
    setDeletingId(m.id);
    try {
      await api.customModules.delete(m.id);
      onRemoved(m.id);
      toast.success(`Module "${m.title}" supprimé`);
    } catch {
      toast.error('Impossible de supprimer');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedType = MODULE_TYPES.find((t) => t.value === form.module_type);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mes modules</h2>
            <p className="text-sm text-gray-500 mt-0.5">Créez des modules sur mesure pour votre organisation</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau module
          </button>
        </div>

        {/* Liste des modules existants */}
        {modules.length === 0 && !showCreate && (
          <p className="text-sm text-gray-400 italic py-4 text-center">Aucun module personnalisé — créez le premier !</p>
        )}
        <div className="space-y-2">
          {modules.map((m) => {
            const mt = MODULE_TYPES.find((t) => t.value === m.module_type);
            const MIcon = mt?.icon ?? Layers;
            return (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${m.color}18` }}>
                    <MIcon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-400">{mt?.label} · {(m._count?.entries ?? 0)} entrée{(m._count?.entries ?? 0) > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(m)}
                  disabled={deletingId === m.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-[#534AB7]/30 p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">Configurer le nouveau module</h3>

          {/* Titre + description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Titre *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
                placeholder="Ex: Fournisseurs IT, Plan de continuité…"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
                placeholder="Courte description…"
              />
            </div>
          </div>

          {/* Type de module */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Type de module</label>
            <div className="grid grid-cols-3 gap-2">
              {MODULE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, module_type: t.value }))}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                    form.module_type === t.value
                      ? 'border-[#534AB7] bg-[#534AB7]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <t.icon className={`w-4 h-4 ${form.module_type === t.value ? 'text-[#534AB7]' : 'text-gray-400'}`} />
                  <span className={`text-xs font-semibold ${form.module_type === t.value ? 'text-[#534AB7]' : 'text-gray-700'}`}>
                    {t.label}
                  </span>
                  <span className="text-[10px] text-gray-400 leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
            {selectedType && (
              <p className="text-xs text-[#534AB7] mt-2 flex items-center gap-1">
                <selectedType.icon className="w-3 h-3" />
                Champs disponibles : {selectedType.desc}
              </p>
            )}
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Couleur</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Aperçu */}
          {form.title && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 bg-gray-50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${form.color}18` }}>
                {selectedType && <selectedType.icon className="w-4 h-4" style={{ color: form.color }} />}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: form.color }}>{form.title}</p>
                <p className="text-[11px] text-gray-400">{form.description || selectedType?.label}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="button" onClick={handleCreate} disabled={saving || !form.title.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Création…' : 'Créer le module'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Catégories personnalisées ───

const CATEGORY_TYPES: { value: CategoryType; label: string; desc: string; color: string }[] = [
  { value: 'subscription', label: 'Abonnements', desc: 'Dev, Sécurité, Cloud, Marketing…', color: '#EF9F27' },
  { value: 'platform', label: 'Plateformes', desc: 'Administration, Dev, RH, Finance…', color: '#534AB7' },
  { value: 'team', label: 'Équipes', desc: 'Devs_mobile, Infra, DRH, Commercial…', color: '#1D9E75' },
];

const PALETTE = ['#534AB7','#1D9E75','#E24B4A','#EF9F27','#3B82F6','#6B7280','#EC4899','#8B5CF6','#14B8A6','#F97316'];

interface CategoriesSectionProps {
  categories: Category[];
  onAdded: (c: Category) => void;
  onRemoved: (id: string) => void;
}

function CategoriesSection({ categories, onAdded, onRemoved }: CategoriesSectionProps) {
  const [activeType, setActiveType] = useState<CategoryType>('subscription');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#534AB7');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const current = categories.filter((c) => c.type === activeType);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const created = await api.categories.create({ type: activeType, label: newLabel.trim(), color: newColor });
      onAdded(created);
      setNewLabel('');
      toast.success(`Catégorie "${created.label}" ajoutée`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    setDeletingId(id);
    try {
      await api.categories.delete(id);
      onRemoved(id);
      toast.success(`Catégorie "${label}" supprimée`);
    } catch {
      toast.error('Impossible de supprimer');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Catégories personnalisées</h2>
        <p className="text-sm text-gray-500 mt-1">
          Définissez les catégories propres à votre organisation pour les abonnements, plateformes et équipes.
        </p>
      </div>

      {/* Onglets par type */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        {CATEGORY_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeType === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Description du type actif */}
      <p className="text-xs text-gray-400">
        Exemples : {CATEGORY_TYPES.find((t) => t.value === activeType)?.desc}
      </p>

      {/* Liste des catégories existantes */}
      <div className="space-y-2">
        {current.length === 0 && (
          <p className="text-sm text-gray-400 italic py-2">
            Aucune catégorie pour "{CATEGORY_TYPES.find((t) => t.value === activeType)?.label}" — ajoutez-en une ci-dessous.
          </p>
        )}
        {current.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 group">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm font-medium text-gray-800">{c.label}</span>
            </div>
            <button
              onClick={() => handleDelete(c.id, c.label)}
              disabled={deletingId === c.id}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              {deletingId === c.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <X className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>

      {/* Ajouter une catégorie */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Ajouter une catégorie</p>
        <div className="flex items-center gap-3">
          {/* Sélecteur de couleur */}
          <div className="flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={`Nom de la catégorie…`}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newLabel.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan & Facturation ───

const PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: '0 €',
    period: '/mois',
    icon: Zap,
    color: '#6B7280',
    desc: 'Pour découvrir Tracix',
    features: [
      '10 membres max',
      '3 plateformes max',
      '5 catégories',
      'Modules de base',
      'Alertes automatiques',
    ],
    limits: ['Pas d\'export XLSX', 'Pas de modules personnalisés'],
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '49 €',
    period: '/mois',
    icon: Star,
    color: '#534AB7',
    desc: 'Pour les équipes IT actives',
    features: [
      'Membres illimités',
      'Plateformes illimitées',
      'Catégories illimitées',
      'Modules personnalisés illimités',
      'Export XLSX',
      'API REST incluse',
      'Toutes les intégrations',
      'Support prioritaire',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 'Sur devis',
    period: '',
    icon: Crown,
    color: '#EF9F27',
    desc: 'Pour les grandes organisations',
    features: [
      'Tout le plan Pro',
      'Multi-organisations',
      'SSO / LDAP',
      'API REST complète',
      'Marque blanche',
      'SLA garanti',
      'Account manager dédié',
    ],
    limits: [],
  },
];

interface PlanUsage {
  plan: string;
  limits: { members: number; platforms: number; customModules: number; categories: number; exportEnabled: boolean; customModulesEnabled: boolean };
  usage: { members: number; platforms: number; customModules: number; categories: number };
}

function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = max === -1 ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isUnlimited = max === -1;
  const isWarning = !isUnlimited && pct >= 80;
  const isFull = !isUnlimited && pct >= 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className={`text-xs font-medium ${isFull ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-500'}`}>
          {isUnlimited ? `${current} / ∞` : `${current} / ${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isFull ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-[#534AB7]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanSection({ organization, onUpdated }: { organization: Organization | null; onUpdated: (o: Organization) => void }) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    api.plan.limits().then(setUsage).catch(() => {});
  }, []);

  if (!organization) return null;

  const currentPlan = PLANS.find((p) => p.id === organization.plan) ?? PLANS[0];
  const PlanIcon = currentPlan.icon;

  const planExpiresAt = organization.plan_expires_at ? new Date(organization.plan_expires_at) : null;
  const daysLeft = planExpiresAt ? Math.floor((planExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-4">
      {/* Plan actuel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Plan & Facturation</h2>
            <p className="text-sm text-gray-500 mt-0.5">Gérez votre abonnement Tracix</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ borderColor: `${currentPlan.color}40`, backgroundColor: `${currentPlan.color}10` }}>
            <PlanIcon className="w-4 h-4" style={{ color: currentPlan.color }} />
            <span className="text-sm font-bold" style={{ color: currentPlan.color }}>{currentPlan.label}</span>
          </div>
        </div>

        {/* Avertissement expiration */}
        {planExpiresAt && daysLeft !== null && daysLeft <= 7 && organization.plan !== 'free' && (
          <div className={`flex items-start gap-3 p-3 rounded-xl border mb-4 ${daysLeft <= 1 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${daysLeft <= 1 ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${daysLeft <= 1 ? 'text-red-700' : 'text-amber-700'}`}>
                {daysLeft <= 0 ? 'Plan expiré' : `Plan expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
              </p>
              <p className={`text-xs mt-0.5 ${daysLeft <= 1 ? 'text-red-600' : 'text-amber-600'}`}>
                {daysLeft <= 0
                  ? 'Votre plan est expiré. Renouvelez pour retrouver toutes vos fonctionnalités.'
                  : `Échéance le ${planExpiresAt.toLocaleDateString('fr-FR')}. Renouvelez pour éviter toute interruption.`}
              </p>
            </div>
          </div>
        )}

        {/* Date d'expiration si plan payant */}
        {planExpiresAt && daysLeft !== null && daysLeft > 7 && organization.plan !== 'free' && (
          <p className="text-xs text-gray-400 mb-4">
            Renouvellement le {planExpiresAt.toLocaleDateString('fr-FR')} — dans {daysLeft} jours
          </p>
        )}

        {/* Usage */}
        {usage && (
          <div className="space-y-3 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisation</p>
            <UsageBar current={usage.usage.members} max={usage.limits.members} label="Membres" />
            <UsageBar current={usage.usage.platforms} max={usage.limits.platforms} label="Plateformes" />
            <UsageBar current={usage.usage.customModules} max={usage.limits.customModules} label="Modules personnalisés" />
            <UsageBar current={usage.usage.categories} max={usage.limits.categories} label="Catégories" />
          </div>
        )}

        {organization.plan === 'free' && (
          <div className="bg-[#534AB7]/5 border border-[#534AB7]/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Passez à Pro pour débloquer tout</p>
              <p className="text-xs text-gray-500 mt-0.5">Membres illimités, modules personnalisés, export XLSX…</p>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors flex-shrink-0"
            >
              <Star className="w-4 h-4" />
              Passer à Pro
            </button>
          </div>
        )}

        {organization.plan === 'pro' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Besoin de plus ? Découvrez Enterprise</p>
              <p className="text-xs text-gray-500 mt-0.5">Multi-org, SSO, API, marque blanche, SLA…</p>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex-shrink-0"
            >
              <Crown className="w-4 h-4" />
              Voir Enterprise
            </button>
          </div>
        )}
      </div>

      {/* Comparatif des plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = organization.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border p-5 relative ${isCurrent ? 'border-[#534AB7] shadow-md' : 'border-gray-200'}`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#534AB7] text-white text-[10px] font-bold rounded-full">
                  PLAN ACTUEL
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5" style={{ color: plan.color }} />
                <span className="font-bold text-gray-900">{plan.label}</span>
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-400">{plan.period}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{plan.desc}</p>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
                {plan.limits.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-400">
                    <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan.id !== 'free' && (
                <button
                  onClick={() => navigate('/paiement')}
                  className="w-full py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-90"
                  style={{ borderColor: plan.color, color: plan.color }}
                >
                  Choisir {plan.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showUpgrade && (
        <UpgradeModal
          currentPlan={organization.plan}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}

function UpgradeModal({ currentPlan, onClose }: {
  currentPlan: string;
  onClose: () => void;
  onUpgraded?: (plan: string) => void;
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(currentPlan === 'free' ? 'pro' : 'enterprise');

  const handleConfirm = () => {
    onClose();
    navigate('/paiement');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-lg">
          <X className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Changer de plan</h2>
        <p className="text-sm text-gray-500 mb-5">Sélectionnez le plan qui correspond à vos besoins</p>

        <div className="space-y-3 mb-6">
          {PLANS.filter((p) => p.id !== 'free').map((plan) => {
            const Icon = plan.icon;
            const isSelected = selected === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected ? 'border-[#534AB7] bg-[#534AB7]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className="w-6 h-6 flex-shrink-0" style={{ color: plan.color }} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{plan.label} — {plan.price}{plan.period}</p>
                  <p className="text-xs text-gray-500">{plan.desc}</p>
                </div>
                {isSelected && <Check className="w-5 h-5 text-[#534AB7]" />}
              </button>
            );
          })}
        </div>

        {selected === 'enterprise' ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">Contactez-nous pour un devis personnalisé Enterprise.</p>
            <a
              href="mailto:contact@agbayagroup.com"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Nous contacter
            </a>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={selected === currentPlan}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60"
          >
            <CreditCard className="w-4 h-4" />
            Procéder au paiement
          </button>
        )}
      </div>
    </div>
  );
}

function ResetDataModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const [typed, setTyped] = useState('');
  const confirmWord = 'RÉINITIALISER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Réinitialiser toutes les données</h2>
              <p className="text-sm text-gray-500 mt-0.5">Cette action est irréversible.</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-red-800">Les éléments suivants seront supprimés :</p>
            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li>Tous les membres</li>
              <li>Toutes les plateformes</li>
              <li>Tous les droits d'accès</li>
              <li>Toutes les alertes</li>
              <li>Tout le journal d'audit</li>
              <li>Tous les abonnements</li>
              <li>Tous les systèmes et flux réseau</li>
              <li>Tous les modules personnalisés et leurs entrées</li>
              <li>Toutes les catégories</li>
            </ul>
            <p className="text-sm font-semibold text-red-800 mt-2">Votre compte et votre organisation seront conservés.</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">
              Pour confirmer, tapez <span className="font-mono font-bold text-gray-900">{confirmWord}</span> ci-dessous :
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || typed !== confirmWord}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {loading ? 'Réinitialisation…' : 'Tout supprimer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next.length < 8) { toast.error('Le mot de passe doit faire au moins 8 caractères'); return; }
    if (form.next !== form.confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      await api.auth.changePassword(form.current, form.next);
      toast.success('Mot de passe modifié');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      {/* Mot de passe actuel */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mot de passe actuel</label>
        <div className="relative">
          <input type={show.current ? 'text' : 'password'} value={form.current} onChange={set('current')}
            required autoComplete="current-password"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#534AB7]" />
          <button type="button" onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {/* Nouveau mot de passe */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nouveau mot de passe</label>
        <div className="relative">
          <input type={show.next ? 'text' : 'password'} value={form.next} onChange={set('next')}
            required autoComplete="new-password" minLength={8}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#534AB7]" />
          <button type="button" onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {form.next.length > 0 && form.next.length < 8 && (
          <p className="text-[11px] text-amber-600 mt-1">Au moins 8 caractères</p>
        )}
      </div>
      {/* Confirmation */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirmer le nouveau mot de passe</label>
        <input type="password" value={form.confirm} onChange={set('confirm')}
          required autoComplete="new-password"
          className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#534AB7] ${form.confirm && form.confirm !== form.next ? 'border-red-300' : 'border-gray-200'}`} />
        {form.confirm && form.confirm !== form.next && (
          <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
        )}
      </div>
      <button type="submit" disabled={loading || !form.current || !form.next || form.next !== form.confirm}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] disabled:opacity-50 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {loading ? 'Enregistrement…' : 'Modifier le mot de passe'}
      </button>
    </form>
  );
}

function MfaSection() {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; qr: string } | null>(null);
  const [totpInput, setTotpInput] = useState('');
  const [disableInput, setDisableInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.auth.mfaStatus().then((d) => setMfaEnabled(d.enabled)).catch(() => {});
  }, []);

  const startSetup = async () => {
    setLoading(true);
    try {
      const data = await api.auth.mfaSetup();
      setSetupData(data);
      setTotpInput('');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const confirmEnable = async () => {
    setLoading(true);
    try {
      await api.auth.mfaEnable(totpInput);
      setMfaEnabled(true);
      setSetupData(null);
      setTotpInput('');
      toast.success('MFA activé — votre compte est maintenant protégé');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Code incorrect'); setTotpInput(''); }
    finally { setLoading(false); }
  };

  const disableMfa = async () => {
    setLoading(true);
    try {
      await api.auth.mfaDisable(disableInput);
      setMfaEnabled(false);
      setDisableInput('');
      toast.success('MFA désactivé');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Code incorrect'); setDisableInput(''); }
    finally { setLoading(false); }
  };

  if (mfaEnabled === null) return <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Statut */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${mfaEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${mfaEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
          {mfaEnabled ? <Lock className="w-4 h-4 text-green-600" /> : <Unlock className="w-4 h-4 text-gray-400" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{mfaEnabled ? 'MFA activé' : 'MFA désactivé'}</p>
          <p className="text-xs text-gray-500">
            {mfaEnabled ? 'Un code est requis à chaque connexion.' : 'Aucune vérification supplémentaire.'}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
          {mfaEnabled ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {/* Flow activation */}
      {!mfaEnabled && !setupData && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            Scannez un QR code avec Google Authenticator, Authy ou 1Password pour sécuriser votre compte avec un code à 6 chiffres.
          </p>
          <button onClick={startSetup} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {loading ? 'Génération…' : 'Configurer le MFA'}
          </button>
        </div>
      )}

      {/* QR code + confirmation */}
      {!mfaEnabled && setupData && (
        <div className="space-y-4 p-4 rounded-xl border border-[#534AB7]/20 bg-[#534AB7]/5">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#534AB7]" />
            <p className="text-sm font-semibold text-gray-900">Scannez ce QR code</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <img src={setupData.qr} alt="QR MFA" className="w-36 h-36 rounded-lg border border-gray-200 bg-white p-1.5 flex-shrink-0" />
            <div className="flex-1 w-full space-y-2">
              <p className="text-xs text-gray-500">Ou entrez ce secret manuellement :</p>
              <p className="text-xs font-mono bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 break-all tracking-wider">{setupData.secret}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirmez avec un code de votre app</label>
            <input type="text" inputMode="numeric" maxLength={6}
              value={totpInput} onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono tracking-[0.4em] outline-none focus:border-[#534AB7]"
              placeholder="000000" autoFocus />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setSetupData(null); setTotpInput(''); }}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={confirmEnable} disabled={loading || totpInput.length !== 6}
              className="flex-1 py-2 rounded-xl bg-[#534AB7] text-white text-sm font-medium hover:bg-[#3C3489] disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? 'Activation…' : 'Activer'}
            </button>
          </div>
        </div>
      )}

      {/* Flow désactivation */}
      {mfaEnabled && (
        <div className="space-y-3 p-4 rounded-xl border border-red-100 bg-red-50/50">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-gray-700">Désactiver le MFA</p>
          </div>
          <p className="text-xs text-gray-500">Entrez un code de votre app pour confirmer.</p>
          <input type="text" inputMode="numeric" maxLength={6}
            value={disableInput} onChange={(e) => setDisableInput(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono tracking-[0.4em] outline-none focus:border-red-400"
            placeholder="000000" />
          <button onClick={disableMfa} disabled={loading || disableInput.length !== 6}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            {loading ? 'Désactivation…' : 'Désactiver le MFA'}
          </button>
        </div>
      )}
    </div>
  );
}

function SecuriteSection() {
  const [revoking, setRevoking] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleRevokeSessions = async () => {
    setRevoking(true);
    try {
      await api.auth.logout();
      toast.success('Toutes les autres sessions ont été révoquées');
    } catch {
      toast.error('Erreur lors de la révocation des sessions');
    } finally {
      setRevoking(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.organizations.reset();
      setResetModalOpen(false);
      toast.success('Toutes les données ont été réinitialisées');
    } catch {
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {resetModalOpen && (
        <ResetDataModal
          onClose={() => setResetModalOpen(false)}
          onConfirm={handleReset}
          loading={resetting}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">Sécurité</h2>

        {/* Changer le mot de passe */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#534AB7]" />
            Changer le mot de passe
          </h3>
          <ChangePasswordForm />
        </div>

        {/* MFA */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#534AB7]" />
            Authentification à deux facteurs (MFA)
          </h3>
          <MfaSection />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Sessions actives</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-800">Cette session — {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Navigateur'}</p>
                  <p className="text-xs text-gray-500">Actuelle</p>
                </div>
              </div>
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
            </div>
          </div>
          <button
            onClick={handleRevokeSessions}
            disabled={revoking}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {revoking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Révoquer toutes les autres sessions
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Zone de danger</h3>
          <p className="text-xs text-gray-500 mb-3">
            Supprime définitivement tous les membres, plateformes, droits d'accès et données de l'organisation.
            Votre compte reste intact.
          </p>
          <button
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Réinitialiser toutes les données
          </button>
        </div>
      </div>
    </>
  );
}
