// ═══════════════════════════════════════════
// Layout principal — Sidebar + Header + Content
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, Server, Network, CreditCard,
  Bell, FileText, ScrollText, Settings, LogOut, Menu, X,
  ChevronDown, ShieldCheck, BarChart2, GitBranch, Import,
  Plus, Building2, Check, ClipboardCheck,
} from 'lucide-react';
import type { UserApp, Organization, ModuleId, CustomModule, CustomModuleType } from '@/types';
import type { OrgEntry } from '@/hooks/useStore';

const CUSTOM_MODULE_ICONS: Record<CustomModuleType, React.ElementType> = {
  liste: BarChart2,
  contacts: Users,
  documents: FileText,
  procedures: ScrollText,
  notes: FileText,
  kpis: BarChart2,
};

interface AppLayoutProps {
  children: React.ReactNode;
  user: UserApp;
  organization: Organization;
  onLogout: () => void;
  unresolvedAlerts: number;
  customModules?: CustomModule[];
  userOrganizations?: OrgEntry[];
  onSwitchOrg?: (orgId: string) => Promise<boolean>;
  onCreateOrg?: (name: string) => Promise<boolean>;
}

// Modules always visible regardless of enabled_modules
const CORE_PATHS = new Set(['/dashboard', '/parametres']);

const ALL_NAV_ITEMS: { path: string; moduleId?: ModuleId; label: string; icon: React.ElementType }[] = [
  { path: '/dashboard',       label: 'Tableau de bord',  icon: LayoutDashboard },
  { path: '/habilitations',   moduleId: 'habilitations',  label: 'Habilitations',    icon: GitBranch },
  { path: '/revues',          moduleId: 'habilitations',  label: "Revues d'accès",   icon: ClipboardCheck },
  { path: '/membres',         moduleId: 'membres',        label: 'Membres',          icon: Users },
  { path: '/plateformes',     moduleId: 'plateformes',    label: 'Plateformes',      icon: ShieldCheck },
  { path: '/score-de-risque', moduleId: 'score-de-risque',label: 'Score de risque',  icon: BarChart2 },
  { path: '/systemes',        moduleId: 'systemes',       label: 'Systèmes',         icon: Server },
  { path: '/flux-reseau',     moduleId: 'flux-reseau',    label: 'Flux réseau',      icon: Network },
  { path: '/abonnements',     moduleId: 'abonnements',    label: 'Abonnements',      icon: CreditCard },
  { path: '/alertes',         moduleId: 'alertes',        label: 'Alertes',          icon: Bell },
  { path: '/journal',         moduleId: 'journal',        label: "Journal d'audit",  icon: ScrollText },
  { path: '/rapports',        moduleId: 'rapports',       label: 'Rapports',         icon: FileText },
  { path: '/import',          moduleId: 'import',         label: 'Import',           icon: Import },
  { path: '/parametres',      label: 'Paramètres',        icon: Settings },
];

export function AppLayout({ children, user, organization, onLogout, unresolvedAlerts, customModules = [], userOrganizations = [], onSwitchOrg, onCreateOrg }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const location = useLocation();

  const isActive = (path: string) =>
    path.startsWith('/modules/')
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const enabledSet = new Set(organization.enabled_modules ?? []);
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(
    (item) => CORE_PATHS.has(item.path) || !item.moduleId || enabledSet.has(item.moduleId)
  );

  const CUSTOM_NAV_ITEMS = customModules.map((m) => ({
    path: `/modules/${m.id}`,
    label: m.title,
    icon: CUSTOM_MODULE_ICONS[m.module_type as CustomModuleType] ?? FileText,
    color: m.color,
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* ─── Sidebar Desktop ─── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[240px] bg-white border-r border-gray-200 flex-col z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <img src="/favicon.png" alt="Tracix" className="w-16 h-16 object-contain mr-3 flex-shrink-0" />
          <div>
            <h1 className="font-bold text-[#534AB7] text-lg leading-tight">Tracix</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">On trace tout. On rate rien.</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-[#534AB7]/10 text-[#534AB7] font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.path === '/alertes' && unresolvedAlerts > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unresolvedAlerts}
                    </span>
                  )}
                </Link>
              );
            })}
            {CUSTOM_NAV_ITEMS.length > 0 && (
              <>
                <div className="mx-3 my-2 border-t border-gray-100" />
                <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Mes modules</p>
                {CUSTOM_NAV_ITEMS.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active ? 'font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      style={active ? { backgroundColor: `${item.color}18`, color: item.color } : {}}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </nav>

        {/* Déconnexion */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* ─── Sidebar Mobile ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-white flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
              <div className="flex items-center">
                <img src="/favicon.png" alt="Tracix" className="w-16 h-16 object-contain mr-3 flex-shrink-0" />
                <h1 className="font-bold text-[#534AB7] text-lg">Tracix</h1>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 ${
                      active
                        ? 'bg-[#534AB7]/10 text-[#534AB7] font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                    {item.path === '/alertes' && unresolvedAlerts > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unresolvedAlerts}
                      </span>
                    )}
                  </Link>
                );
              })}
              {CUSTOM_NAV_ITEMS.length > 0 && (
                <>
                  <div className="mx-3 my-2 border-t border-gray-100" />
                  <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Mes modules</p>
                  {CUSTOM_NAV_ITEMS.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 ${active ? 'font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        style={active ? { backgroundColor: `${item.color}18`, color: item.color } : {}}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
              <button
                onClick={() => { onLogout(); setSidebarOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:bg-gray-50 mt-4"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="flex-1 lg:ml-[240px] min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>

            {/* Org switcher */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#534AB7]/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#534AB7]" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-400 leading-none">Organisation</p>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{organization.name}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {orgMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOrgMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                    <p className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mes organisations</p>
                    {userOrganizations.map(({ org, role }) => (
                      <button
                        key={org.id}
                        disabled={org.id === organization.id || switchingOrg === org.id}
                        onClick={async () => {
                          if (org.id === organization.id) return;
                          setSwitchingOrg(org.id);
                          await onSwitchOrg?.(org.id);
                          setSwitchingOrg(null);
                          setOrgMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: org.id === organization.id ? '#534AB7' : '#9CA3AF' }}>
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{org.name}</p>
                          <p className="text-[11px] text-gray-400">{role} · {org.plan}</p>
                        </div>
                        {org.id === organization.id && <Check className="w-4 h-4 text-[#534AB7] flex-shrink-0" />}
                        {switchingOrg === org.id && <div className="w-4 h-4 border-2 border-gray-300 border-t-[#534AB7] rounded-full animate-spin flex-shrink-0" />}
                      </button>
                    ))}
                    <div className="mx-3 my-1 border-t border-gray-100" />
                    <button
                      onClick={() => { setOrgMenuOpen(false); setShowNewOrgModal(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                        <Plus className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-600 font-medium">Nouvelle organisation</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#534AB7]/10 text-[#534AB7] uppercase">
              {organization.plan}
            </span>
          </div>

          {/* Modal nouvelle org */}
          {showNewOrgModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewOrgModal(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-base font-bold text-gray-800 mb-1">Nouvelle organisation</h3>
                <p className="text-sm text-gray-500 mb-5">Créez un espace de travail indépendant.</p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newOrgName.trim()) return;
                  setCreatingOrg(true);
                  const ok = await onCreateOrg?.(newOrgName.trim());
                  setCreatingOrg(false);
                  if (ok) { setShowNewOrgModal(false); setNewOrgName(''); }
                }}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nom de l'organisation</label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:border-[#534AB7] outline-none mb-4"
                    placeholder="Ex: Ma startup, ONG XYZ…"
                    required
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowNewOrgModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      Annuler
                    </button>
                    <button type="submit" disabled={creatingOrg}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                      style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
                      {creatingOrg ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création…</> : 'Créer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-sm font-medium">
                {user.full_name.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight">{user.full_name}</p>
                <p className="text-[11px] text-gray-400 leading-tight">{user.role}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <Link
                    to="/parametres"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </Link>
                  <button
                    onClick={() => { onLogout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
