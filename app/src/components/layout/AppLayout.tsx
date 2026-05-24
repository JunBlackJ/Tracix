// ═══════════════════════════════════════════
// Layout principal — Sidebar sombre + Topbar
// ═══════════════════════════════════════════

import { useState, useEffect } from 'react';
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

const CORE_PATHS = new Set(['/dashboard', '/parametres']);

const NAV_SECTIONS: { label: string; items: { path: string; moduleId?: ModuleId; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'Monitoring',
    items: [
      { path: '/dashboard',       label: 'Vue d\'ensemble',   icon: LayoutDashboard },
      { path: '/alertes',         moduleId: 'alertes',        label: 'Alertes',          icon: Bell },
      { path: '/score-de-risque', moduleId: 'score-de-risque',label: 'Score de risque',  icon: BarChart2 },
    ],
  },
  {
    label: 'Accès',
    items: [
      { path: '/membres',         moduleId: 'membres',        label: 'Membres',          icon: Users },
      { path: '/habilitations',   moduleId: 'habilitations',  label: 'Habilitations',    icon: GitBranch },
      { path: '/revues',          moduleId: 'habilitations',  label: 'Revues d\'accès',  icon: ClipboardCheck },
      { path: '/plateformes',     moduleId: 'plateformes',    label: 'Plateformes',      icon: ShieldCheck },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { path: '/systemes',        moduleId: 'systemes',       label: 'Systèmes',         icon: Server },
      { path: '/flux-reseau',     moduleId: 'flux-reseau',    label: 'Flux réseau',      icon: Network },
      { path: '/abonnements',     moduleId: 'abonnements',    label: 'Abonnements',      icon: CreditCard },
    ],
  },
  {
    label: 'Audit',
    items: [
      { path: '/journal',         moduleId: 'journal',        label: 'Journal d\'audit', icon: ScrollText },
      { path: '/rapports',        moduleId: 'rapports',       label: 'Rapports',         icon: FileText },
      { path: '/import',          moduleId: 'import',         label: 'Import',           icon: Import },
    ],
  },
];

function NavItem({
  path, label, icon: Icon, active, badge, onClick,
}: {
  path: string; label: string; icon: React.ElementType;
  active: boolean; badge?: number; onClick?: () => void;
}) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all mb-0.5 ${
        active
          ? 'bg-[#534AB7]/20 text-white font-medium'
          : 'text-[hsl(var(--sidebar-foreground))] hover:bg-white/6 hover:text-white'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'opacity-100' : 'opacity-75'}`} />
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-px font-mono">
          {badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({
  location, enabledSet, unresolvedAlerts, customModules, user, organization,
  orgMenuOpen, setOrgMenuOpen, userOrganizations, onSwitchOrg, onCreateOrg,
  showNewOrgModal, setShowNewOrgModal, onLogout, onClose,
}: {
  location: { pathname: string };
  enabledSet: Set<string>;
  unresolvedAlerts: number;
  customModules: CustomModule[];
  user: UserApp;
  organization: Organization;
  orgMenuOpen: boolean;
  setOrgMenuOpen: (v: boolean) => void;
  userOrganizations: OrgEntry[];
  onSwitchOrg?: (orgId: string) => Promise<boolean>;
  onCreateOrg?: (name: string) => Promise<boolean>;
  showNewOrgModal: boolean;
  setShowNewOrgModal: (v: boolean) => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);

  const isActive = (path: string) =>
    path.startsWith('/modules/')
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex flex-col h-full" style={{ background: 'hsl(246 20% 14%)' }}>
      {/* Logo */}
      <div className="flex items-center justify-between gap-2.5 px-5 py-[18px] border-b" style={{ borderColor: 'hsl(246 10% 22%)' }}>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Tracix" className="h-8 w-auto object-contain flex-shrink-0" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4 text-white/50" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-none">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => CORE_PATHS.has(item.path) || !item.moduleId || enabledSet.has(item.moduleId)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-4">
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(246 8% 40%)' }}>
                {section.label}
              </p>
              {visibleItems.map((item) => (
                <NavItem
                  key={item.path}
                  path={item.path}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.path)}
                  badge={item.path === '/alertes' ? unresolvedAlerts : undefined}
                  onClick={onClose}
                />
              ))}
            </div>
          );
        })}

        {customModules.length > 0 && (
          <div className="mb-4">
            <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(246 8% 40%)' }}>
              Mes modules
            </p>
            {customModules.map((m) => {
              const Icon = CUSTOM_MODULE_ICONS[m.module_type as CustomModuleType] ?? FileText;
              const path = `/modules/${m.id}`;
              const active = isActive(path);
              return (
                <Link
                  key={m.id}
                  to={path}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all mb-0.5 ${
                    active ? 'font-medium text-white' : 'text-[hsl(246_8%_72%)] hover:bg-white/6 hover:text-white'
                  }`}
                  style={active ? { backgroundColor: `${m.color}22` } : {}}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: m.color }} />
                  <span className="truncate">{m.title}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer utilisateur */}
      <div className="p-3 border-t" style={{ borderColor: 'hsl(246 10% 22%)' }}>
        {/* Org switcher */}
        <div className="relative mb-1">
          <button
            onClick={() => setOrgMenuOpen(!orgMenuOpen)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all hover:bg-white/6"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: '#534AB7' }}>
              {organization.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-xs font-medium truncate leading-tight">{organization.name}</p>
              <p className="text-[10px] leading-tight" style={{ color: 'hsl(246 8% 50%)' }}>{organization.plan}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(246 8% 50%)' }} />
          </button>

          {orgMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOrgMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20">
                <p className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Organisations</p>
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

        {/* User row */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: '#534AB7' }}>
            {user.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate leading-tight">{user.full_name}</p>
            <p className="text-[10px] truncate leading-tight" style={{ color: 'hsl(246 8% 50%)' }}>{user.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            title="Déconnexion"
          >
            <LogOut className="w-3.5 h-3.5" style={{ color: 'hsl(246 8% 50%)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(
        d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) +
        ' · ' +
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-xs text-gray-400 font-mono hidden lg:inline">{time}</span>;
}

export function AppLayout({
  children, user, organization, onLogout, unresolvedAlerts,
  customModules = [], userOrganizations = [], onSwitchOrg, onCreateOrg,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const location = useLocation();

  const enabledSet = new Set(organization.enabled_modules ?? []);

  const sharedProps = {
    location, enabledSet, unresolvedAlerts, customModules,
    user, organization, orgMenuOpen, setOrgMenuOpen,
    userOrganizations, onSwitchOrg, onCreateOrg,
    showNewOrgModal, setShowNewOrgModal, onLogout,
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'hsl(var(--background))' }}>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[240px] flex-col z-30">
        <SidebarContent {...sharedProps} />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px]">
            <SidebarContent {...sharedProps} onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-[240px] min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-5 lg:px-7 h-14 border-b"
          style={{
            background: 'hsl(220 20% 97% / 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderColor: 'hsl(var(--border))',
          }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          {/* Page title injected via CSS data-title on main */}
          <div className="flex-1" />

          <Clock />

          {/* User menu compact */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: '#534AB7/10', color: '#534AB7', backgroundColor: 'hsl(246 43% 57% / 0.1)' }}>
              {organization.plan}
            </span>
            <Link to="/parametres"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Paramètres">
              <Settings className="w-4 h-4 text-gray-500" />
            </Link>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-default">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: '#534AB7' }}>
                {user.full_name.charAt(0)}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-800">{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-7">{children}</main>
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
                  {creatingOrg
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création…</>
                    : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
