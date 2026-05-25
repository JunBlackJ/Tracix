// ═══════════════════════════════════════════
// Page Plateformes
// ═══════════════════════════════════════════

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, Eye, EyeOff, Globe,
  AlertTriangle, CheckCircle2, XCircle, X, Save, Loader2, Server,
  Pencil, Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACCESS_LEVEL_CONFIG, SEVERITY_CONFIG } from '@/types';
import type { Platform, Member, Alert, AccessRight, Category } from '@/types';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface PlateformesProps {
  platforms: Platform[];
  members: Member[];
  alerts: Alert[];
  accessRights: AccessRight[];
  categories?: Category[];
  onPlatformCreated?: (p: Platform) => void;
  onPlatformUpdated?: (p: Platform) => void;
  onPlatformDeleted?: (id: string) => void;
}

export function Plateformes({ platforms, members, alerts, accessRights, categories = [], onPlatformCreated, onPlatformUpdated, onPlatformDeleted }: PlateformesProps) {
  const { id } = useParams<{ id: string }>();
  const [showForm, setShowForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);

  if (id) return (
    <PlateformeDetail
      platformId={id}
      platforms={platforms}
      members={members}
      alerts={alerts}
      accessRights={accessRights}
      onEdit={(p) => setEditingPlatform(p)}
      onDeleted={onPlatformDeleted}
    />
  );

  return (
    <>
      <PlateformesList
        platforms={platforms}
        members={members}
        alerts={alerts}
        accessRights={accessRights}
        categories={categories}
        onNew={() => setShowForm(true)}
        onEdit={(p) => setEditingPlatform(p)}
        onDeleted={onPlatformDeleted}
      />
      {showForm && (
        <PlatformFormModal
          onClose={() => setShowForm(false)}
          onSaved={(p) => {
            setShowForm(false);
            onPlatformCreated?.(p);
          }}
        />
      )}
      {editingPlatform && (
        <PlatformFormModal
          platform={editingPlatform}
          onClose={() => setEditingPlatform(null)}
          onSaved={(p) => {
            setEditingPlatform(null);
            onPlatformUpdated?.(p);
          }}
        />
      )}
    </>
  );
}

// ─── Helpers ───

function monogramColor(name: string): string {
  const colors = [
    'oklch(48% 0.20 280)', 'oklch(22% 0.02 260)', 'oklch(52% 0.20 240)',
    'oklch(55% 0.19 30)',  'oklch(55% 0.22 52)',  'oklch(52% 0.18 320)',
    'oklch(56% 0.21 40)',  'oklch(50% 0.20 220)', 'oklch(48% 0.20 250)',
    'oklch(58% 0.19 60)',  'oklch(50% 0.18 260)', 'oklch(45% 0.20 295)',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

function KpiSimpleCard({ label, value, delta, deltaUp, kpiColor }: {
  label: string; value: string; delta: string; deltaUp?: boolean; kpiColor: string;
}) {
  return (
    <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpiColor, borderRadius: '10px 10px 0 0' }} />
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', color: 'oklch(18% 0.02 260)' }}>{value}</div>
      <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: deltaUp === true ? 'oklch(62% 0.16 155)' : deltaUp === false ? 'oklch(55% 0.22 25)' : 'oklch(52% 0.012 260)' }}>{delta}</div>
    </div>
  );
}

function timeSince(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

function PlateformesList({ platforms, members: _members, alerts: _alerts, accessRights, categories = [], onNew, onEdit, onDeleted }: PlateformesProps & { onNew: () => void; onEdit: (p: Platform) => void; onDeleted?: (id: string) => void }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Toutes');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, platformId: string) => {
    e.stopPropagation();
    if (!confirm('Supprimer cette plateforme ? Les droits d\'accès associés seront également supprimés.')) return;
    setDeletingId(platformId);
    try {
      await api.platforms.delete(platformId);
      toast.success('Plateforme supprimée');
      onDeleted?.(platformId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  // Build tabs from real platform categories — only show categories that have at least one platform
  const usedCategories = [...new Set(
    platforms.map((p) => p.category?.trim()).filter(Boolean)
  )].sort();
  const tabs = ['Toutes', ...usedCategories];

  // If the active tab no longer has any platforms (e.g. after a data refresh), reset to Toutes
  const safeTab = tabs.includes(activeTab) ? activeTab : 'Toutes';

  // Category color lookup from Category records
  const categoryColorMap = new Map(categories.map((c) => [c.label, c.color]));

  const getPlatformAccess = (platformId: string) =>
    accessRights.filter((a) => a.platform_id === platformId && a.level !== 'none');

  const activeCount = platforms.filter(p => p.status === 'actif').length;
  const errorCount = platforms.filter(p => p.status === 'inactif' || p.status === 'déprécié').length;

  const newThisMonth = platforms.filter(p => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return new Date(p.created_at).getTime() > monthAgo;
  }).length;
  const activeDelta = newThisMonth > 0 ? `↑ +${newThisMonth} ce mois` : 'Stable ce mois';

  const disponibilite = platforms.length > 0
    ? `${Math.round((activeCount / platforms.length) * 100)}%`
    : '—';

  const mostRecentSync = platforms.reduce((best, p) => {
    if (!p.last_check_date) return best;
    const t = new Date(p.last_check_date).getTime();
    return t > best ? t : best;
  }, 0);
  const lastSyncValue = mostRecentSync > 0 ? timeSince(new Date(mostRecentSync).toISOString()) : '—';
  const oldestSync = platforms.reduce((oldest, p) => {
    if (!p.last_check_date) return oldest;
    const t = new Date(p.last_check_date).getTime();
    return t < oldest ? t : oldest;
  }, Infinity);
  const lastSyncDelta = oldestSync < Infinity ? `Sync min: il y a ${timeSince(new Date(oldestSync).toISOString())}` : '— Aucune sync';

  const filtered = platforms.filter(p =>
    safeTab === 'Toutes' || (p.category?.trim() ?? '') === safeTab
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Topbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Plateformes</div>
          <div style={{ fontSize: 12, color: 'oklch(52% 0.012 260)' }}>{platforms.length} plateformes connectées</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none' }}>
          <Plus className="w-3.5 h-3.5" /> Connecter une plateforme
        </button>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <KpiSimpleCard label="Plateformes actives" value={String(activeCount)} delta={activeDelta} deltaUp={newThisMonth > 0} kpiColor="oklch(42% 0.18 280)" />
        <KpiSimpleCard label="En erreur / inactives" value={String(errorCount)} delta={errorCount > 0 ? 'Attention requise' : 'Tout est opérationnel'} deltaUp={errorCount === 0} kpiColor="oklch(55% 0.22 25)" />
        <KpiSimpleCard label="Disponibilité" value={disponibilite} delta={platforms.length > 0 ? `${activeCount} / ${platforms.length} opérationnelles` : 'Aucune plateforme'} kpiColor="oklch(62% 0.16 155)" />
        <KpiSimpleCard label="Dernière sync" value={lastSyncValue} delta={lastSyncDelta} kpiColor="oklch(70% 0.14 88)" />
      </div>

      {/* Tabs + grid section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tabs — built from real platform categories */}
        {tabs.length > 1 && (
          <div style={{ display: 'flex', gap: 2, background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, overflow: 'hidden', width: 'fit-content', flexWrap: 'wrap' }}>
            {tabs.map(tab => {
              const isActive = safeTab === tab;
              const accentColor = tab === 'Toutes' ? 'oklch(42% 0.18 280)' : (categoryColorMap.get(tab) ?? 'oklch(42% 0.18 280)');
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 8, transition: 'background 0.12s, color 0.12s', whiteSpace: 'nowrap', background: isActive ? accentColor : 'transparent', color: isActive ? '#fff' : 'oklch(52% 0.012 260)' }}>
                  {tab}
                  {tab !== 'Toutes' && (
                    <span style={{ marginLeft: 5, fontSize: 10, opacity: isActive ? 0.8 : 0.5, fontFamily: 'JetBrains Mono, monospace' }}>
                      {platforms.filter(p => p.category?.trim() === tab).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Platform grid */}
        {filtered.length === 0 && platforms.length === 0 && (
          <EmptyState icon={Server} title="Aucune plateforme" description="Référencez vos outils SaaS, applications internes et systèmes pour commencer à gérer les accès." action={{ label: '+ Connecter une plateforme', onClick: onNew }} hint="Conseil : importez votre inventaire via le module Import IA." />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {filtered.map(p => {
            const totalUsers = getPlatformAccess(p.id).length;
            const color = monogramColor(p.name);
            const initials = p.name.split(/[\s\-_]/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || p.name.slice(0, 2).toUpperCase();
            const isErr = p.status === 'inactif' || p.status === 'déprécié';
            const lastSync = p.last_check_date ? new Date(p.last_check_date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

            return (
              <div key={p.id} onClick={() => navigate(`/plateformes/${p.id}`)}
                style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer', transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.12s', position: 'relative' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px oklch(42% 0.18 280 / 0.10), 0 2px 6px oklch(0% 0 0 / 0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(80% 0.01 260)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(90% 0.006 260)'; (e.currentTarget as HTMLElement).style.transform = ''; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: '-0.5px', background: color, boxShadow: `0 2px 8px ${color}` }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(18% 0.02 260)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    {isErr
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(55% 0.22 25 / 0.1)', color: 'oklch(55% 0.22 25)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />Erreur</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(62% 0.16 155 / 0.1)', color: 'oklch(62% 0.16 155)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />Actif</span>
                    }
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                      title="Modifier"
                      style={{ padding: '5px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'oklch(52% 0.012 260)', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'oklch(94% 0.006 260)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      title="Supprimer"
                      disabled={deletingId === p.id}
                      style={{ padding: '5px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'oklch(55% 0.22 25)', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'oklch(55% 0.22 25 / 0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {deletingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'oklch(52% 0.012 260)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      {totalUsers} membres
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: isErr ? 'oklch(55% 0.22 25)' : 'oklch(52% 0.012 260)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                      {p.status === 'inactif' ? 'Inactif' : p.status === 'déprécié' ? 'Déprécié' : lastSync !== '—' ? `Vérifié le ${lastSync}` : 'Non vérifié'}
                    </div>
                  </div>
                  {p.category?.trim() && (() => {
                    const catColor = categoryColorMap.get(p.category.trim()) ?? color;
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: `${catColor}22`, color: catColor }}>
                        {p.category.trim()}
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface PlateformeDetailProps {
  platformId: string;
  platforms: Platform[];
  members: Member[];
  alerts: Alert[];
  accessRights: AccessRight[];
  onEdit?: (p: Platform) => void;
  onDeleted?: (id: string) => void;
}

function PlateformeDetail({ platformId, platforms, members, alerts, accessRights, onEdit, onDeleted }: PlateformeDetailProps) {
  const navigate = useNavigate();
  const [showUrl, setShowUrl] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const platform = platforms.find((p) => p.id === platformId);
  if (!platform) return <div>Plateforme non trouvée</div>;

  const handleDelete = async () => {
    if (!confirm(`Supprimer "${platform.name}" ? Les droits d'accès associés seront également supprimés.`)) return;
    setDeleting(true);
    try {
      await api.platforms.delete(platform.id);
      toast.success('Plateforme supprimée');
      onDeleted?.(platform.id);
      navigate('/plateformes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  const access = accessRights.filter((a) => a.platform_id === platformId);
  const platformAlerts = alerts.filter((a) => a.source_id === platformId && !a.is_resolved);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/plateformes')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <PlatformIcon name={platform.name} category={platform.category} size={44} />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{platform.name}</h1>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${platform.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {platform.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{platform.category} · {platform.access_type} · {platform.environment}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit?.(platform)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Pencil className="w-3.5 h-3.5" /> Modifier
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Supprimer
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">URL</p>
            <div className="flex items-center gap-2 mt-1">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 font-mono">
                {showUrl ? platform.url : '••••••••••••••••'}
              </span>
              <button onClick={() => setShowUrl(!showUrl)} className="text-[#534AB7] hover:underline">
                {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">Authentification</p>
            <p className="text-sm text-gray-700 mt-1">{platform.auth_method}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">MFA</p>
            <p className={`text-sm mt-1 flex items-center gap-1 ${platform.has_mfa ? 'text-green-600' : 'text-red-600'}`}>
              {platform.has_mfa ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {platform.has_mfa ? 'Activé' : 'Non activé'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Responsable</p>
            <p className="text-sm text-gray-700 mt-1">{platform.responsible}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">SLA</p>
            <p className="text-sm text-gray-700 mt-1">{platform.sla}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Population cible</p>
            <p className="text-sm text-gray-700 mt-1">{platform.target_population}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Dernière vérification</p>
            <p className="text-sm text-gray-700 mt-1">{new Date(platform.last_check_date).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Qui a accès ? ({access.filter((a) => a.level !== 'none').length} utilisateurs)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-600">Membre</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Niveau</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Accordé le</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Dernière revue</th>
            </tr>
          </thead>
          <tbody>
            {access.filter((a) => a.level !== 'none').map((a) => {
              const member = members.find((m) => m.id === a.member_id);
              const cfg = ACCESS_LEVEL_CONFIG[a.level];
              return (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-[10px] font-medium">
                        {member?.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{member?.full_name || '?'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{new Date(a.granted_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2.5 text-gray-500">{a.last_review_date ? new Date(a.last_review_date).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {platformAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alertes ({platformAlerts.length})
          </h3>
          <div className="space-y-2">
            {platformAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <div key={alert.id} className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <p className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</p>
                  <p className="text-xs text-gray-700 mt-1">{alert.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal création plateforme ───

interface PlatformFormModalProps {
  platform?: Platform;
  onClose: () => void;
  onSaved: (p: Platform) => void;
}

function PlatformFormModal({ platform, onClose, onSaved }: PlatformFormModalProps) {
  const isEdit = !!platform;
  const [form, setForm] = useState({
    name: platform?.name ?? '',
    category: platform?.category ?? '',
    access_type: platform?.access_type ?? '',
    url: platform?.url ?? '',
    auth_method: platform?.auth_method ?? '',
    has_mfa: platform?.has_mfa ?? false,
    environment: (platform?.environment ?? 'production') as 'production' | 'staging' | 'dev',
    responsible: platform?.responsible ?? '',
    target_population: platform?.target_population ?? '',
    sla: platform?.sla ?? '',
    status: (platform?.status ?? 'actif') as 'actif' | 'inactif' | 'déprécié',
    last_check_date: platform?.last_check_date ?? '',
    notes: platform?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validate = () => {
    const e: Partial<Record<string, string>> = {};
    if (!form.name.trim()) e.name = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.platforms.update(platform!.id, form)
        : await api.platforms.create(form);
      toast.success(isEdit ? 'Plateforme mise à jour' : 'Plateforme créée avec succès');
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const inp = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const cls = (key: string) =>
    `w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Modifier la plateforme' : 'Nouvelle plateforme'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nom *</label>
            <input {...inp('name')} className={cls('name')} placeholder="Ex: GitHub, Notion, AWS…" />
            {errors.name && <p className="text-[11px] text-red-500 mt-0.5">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
              <input {...inp('category')} className={cls('category')} placeholder="Ex: DevOps, Cloud, SaaS…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type d'accès</label>
              <input {...inp('access_type')} className={cls('access_type')} placeholder="Ex: Web, API, SSH…" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">URL</label>
            <input {...inp('url')} className={cls('url')} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Méthode d'auth</label>
              <input {...inp('auth_method')} className={cls('auth_method')} placeholder="Ex: SSO, Login/mdp…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
              <input {...inp('responsible')} className={cls('responsible')} placeholder="Ex: Jean Martin" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Environnement</label>
              <select {...inp('environment')} className={cls('environment')}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="dev">Dev</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Statut</label>
              <select {...inp('status')} className={cls('status')}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="déprécié">Déprécié</option>
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_mfa}
                  onChange={(e) => setForm((f) => ({ ...f, has_mfa: e.target.checked }))}
                  className="w-4 h-4 accent-[#534AB7]"
                />
                <span className="text-xs font-semibold text-gray-700">MFA activé</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              {...inp('notes')}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
              placeholder="Informations complémentaires…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde…' : isEdit ? 'Enregistrer les modifications' : 'Créer la plateforme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
