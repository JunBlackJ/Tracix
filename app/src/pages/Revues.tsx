// ═══════════════════════════════════════════
// Page Revues d'accès — Campagnes de revue
// ═══════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Plus, X, Loader2,
  Users, Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ACCESS_LEVEL_CONFIG } from '@/types';
import type { ReviewCampaign, ReviewItem, Member, Platform } from '@/types';

interface RevuesProps {
  members: Member[];
  platforms: Platform[];
}

// ─── Pill ───
function Pill({ variant, children }: { variant: 'crit' | 'high' | 'med' | 'low' | 'brand'; children: React.ReactNode }) {
  const styles = {
    crit:  'bg-[oklch(55%_0.22_25_/_0.1)]  text-[oklch(55%_0.22_25)]',
    high:  'bg-[oklch(62%_0.18_52_/_0.1)]  text-[oklch(62%_0.18_52)]',
    med:   'bg-[oklch(70%_0.14_88_/_0.1)]  text-[oklch(70%_0.14_88)]',
    low:   'bg-[oklch(62%_0.16_155_/_0.1)] text-[oklch(62%_0.16_155)]',
    brand: 'bg-[oklch(42%_0.18_280_/_0.12)] text-[oklch(42%_0.18_280)]',
  };
  return (
    <span className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[11px] font-semibold ${styles[variant]}`}>
      <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" />
      {children}
    </span>
  );
}

// ─── Création de campagne ───
function CreateCampaignModal({ platforms, members, onClose, onCreated }: {
  platforms: Platform[];
  members: Member[];
  onClose: () => void;
  onCreated: (c: ReviewCampaign) => void;
}) {
  const [name, setName] = useState(`Revue d'accès — ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const teams = useMemo(() => [...new Set(members.map((m) => m.team))].sort(), [members]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const c = await api.reviews.create({
        name: name.trim(),
        description,
        due_date: dueDate,
        platformIds: selectedPlatforms.length ? selectedPlatforms : undefined,
        teamFilter: teamFilter || undefined,
      });
      toast.success(`Campagne créée — ${c.totalItems} droits à revoir`);
      onCreated(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-[oklch(42%_0.18_280_/_0.12)] flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-[oklch(42%_0.18_280)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Nouvelle campagne de revue</p>
            <p className="text-xs text-gray-400">Tous les droits actifs seront mis en liste de revue</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom de la campagne *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-[7px] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(42%_0.18_280_/_0.3)]"
              placeholder="Ex: Revue annuelle Q1 2026" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description (optionnel)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-[7px] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(42%_0.18_280_/_0.3)] resize-none"
              placeholder="Contexte ou instructions pour les reviewers…" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date limite (optionnel)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-[7px] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(42%_0.18_280_/_0.3)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />Équipe (optionnel)
              </label>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-[7px] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(42%_0.18_280_/_0.3)]">
                <option value="">Toutes les équipes</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <Layers className="w-3 h-3 inline mr-1" />Plateformes (optionnel)
              </label>
              <select multiple value={selectedPlatforms}
                onChange={(e) => setSelectedPlatforms([...e.target.selectedOptions].map((o) => o.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-[7px] text-xs focus:outline-none focus:ring-2 focus:ring-[oklch(42%_0.18_280_/_0.3)] h-20">
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {selectedPlatforms.length > 0 && <p className="text-[10px] text-[oklch(42%_0.18_280)] mt-0.5">{selectedPlatforms.length} sélectionnée(s)</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-[7px] text-sm font-medium text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading || !name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[oklch(42%_0.18_280)] text-white rounded-[7px] text-sm font-bold hover:brightness-110 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {loading ? 'Création…' : 'Lancer la campagne'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending decisions table ───
function PendingDecisionsTable({ items, members, platforms, onDecide, onBulk }: {
  items: ReviewItem[];
  members: Member[];
  platforms: Platform[];
  onDecide: (item: ReviewItem, decision: 'confirmed' | 'revoked') => void;
  onBulk?: (campaignId: string, decision: 'confirmed' | 'revoked') => void;
}) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const platformById = useMemo(() => new Map(platforms.map((p) => [p.id, p])), [platforms]);

  const RISK_PILL: Record<string, { variant: 'crit' | 'high' | 'med' | 'low' | 'brand'; label: string }> = {
    admin: { variant: 'crit', label: 'Critique' },
    rw:    { variant: 'high', label: 'Élevé' },
    ro:    { variant: 'med',  label: 'Moyen' },
    req:   { variant: 'low',  label: 'Faible' },
  };

  // Group pending items by campaign for bulk actions
  const campaignIds = onBulk ? [...new Set(items.map((i) => i.campaign_id))] : [];

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-gray-400">
        Aucune décision en attente
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {onBulk && campaignIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '11.5px', color: 'oklch(52% 0.012 260)' }}>{items.length} décision{items.length > 1 ? 's' : ''} en attente — Actions groupées :</span>
          {campaignIds.map((cId) => (
            <div key={cId} style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => onBulk(cId, 'confirmed')}
                style={{ background: 'oklch(62% 0.16 155 / 0.12)', color: 'oklch(62% 0.16 155)', border: '1px solid oklch(62% 0.16 155 / 0.3)', fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                Tout maintenir
              </button>
              <button onClick={() => onBulk(cId, 'revoked')}
                style={{ background: 'transparent', color: 'oklch(55% 0.22 25)', border: '1px solid oklch(55% 0.22 25 / 0.3)', fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                Tout révoquer
              </button>
            </div>
          ))}
        </div>
      )}
    <div style={{ border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', overflow: 'hidden', background: 'oklch(100% 0 0)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {['Membre', 'Plateforme', 'Droit', 'Dernière utilisation', 'Risque', 'Décision'].map((h) => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const m = memberById.get(item.member_id);
              const p = platformById.get(item.platform_id);
              const lvl = ACCESS_LEVEL_CONFIG[item.original_level as keyof typeof ACCESS_LEVEL_CONFIG];
              const risk = RISK_PILL[item.original_level] ?? { variant: 'med' as const, label: item.original_level };
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '11px 20px', fontSize: '12.5px', fontWeight: 500 }}>
                    {m?.email ?? m?.full_name ?? item.member_id}
                  </td>
                  <td style={{ padding: '11px 20px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(42% 0.18 280)' }}>
                      {p?.name ?? item.platform_id}
                    </span>
                  </td>
                  <td style={{ padding: '11px 20px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
                      {lvl?.label ?? item.original_level}
                    </span>
                  </td>
                  <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
                    {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString('fr-FR') : 'Jamais'}
                  </td>
                  <td style={{ padding: '11px 20px' }}>
                    <Pill variant={risk.variant}>{risk.label}</Pill>
                  </td>
                  <td style={{ padding: '11px 20px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => onDecide(item, 'confirmed')}
                        style={{ background: 'oklch(62% 0.16 155 / 0.12)', color: 'oklch(62% 0.16 155)', border: '1px solid oklch(62% 0.16 155 / 0.3)', fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(62% 0.16 155 / 0.22)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'oklch(62% 0.16 155 / 0.12)')}>
                        Maintenir
                      </button>
                      <button onClick={() => onDecide(item, 'revoked')}
                        style={{ background: 'transparent', color: 'oklch(55% 0.22 25)', border: '1px solid oklch(55% 0.22 25 / 0.3)', fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(55% 0.22 25 / 0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        Révoquer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

// ─── Campaign card ───
function CampaignCard({ campaign, onView, onComplete }: { campaign: ReviewCampaign; onView: () => void; onComplete?: () => void }) {
  const progress = campaign.totalItems > 0 ? Math.round((campaign.completedItems / campaign.totalItems) * 100) : 0;
  const isLate = campaign.due_date && campaign.status === 'active' && new Date(campaign.due_date) < new Date();
  const isDone = campaign.status === 'completed';

  let statusPill: { variant: 'high' | 'brand' | 'low'; label: string };
  if (isLate) statusPill = { variant: 'high', label: 'En retard' };
  else if (isDone) statusPill = { variant: 'low', label: 'Complétée' };
  else statusPill = { variant: 'brand', label: 'Active' };

  let progressColor = 'oklch(42% 0.18 280)';
  if (isLate) progressColor = 'oklch(62% 0.18 52)';
  else if (isDone) progressColor = 'oklch(62% 0.16 155)';

  let deadlineClass = '';
  let deadlineText = '';
  if (campaign.due_date) {
    const due = new Date(campaign.due_date);
    const now = new Date();
    const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (isDone) {
      deadlineText = `Clôturée le ${new Date(campaign.completed_at ?? campaign.due_date).toLocaleDateString('fr-FR')}`;
      deadlineClass = 'text-[oklch(62%_0.16_155)]';
    } else if (diffDays < 0) {
      deadlineText = `En retard de ${Math.abs(diffDays)} jours`;
      deadlineClass = 'text-[oklch(55%_0.22_25)]';
    } else if (diffDays <= 14) {
      deadlineText = `Échéance dans ${diffDays} jours`;
      deadlineClass = 'text-[oklch(62%_0.18_52)]';
    } else {
      deadlineText = `Échéance dans ${diffDays} jours`;
      deadlineClass = 'text-[oklch(62%_0.16_155)]';
    }
  }


  return (
    <div style={{ background: 'oklch(100% 0 0)', border: `1px solid ${isLate ? 'oklch(62% 0.18 52 / 0.4)' : 'oklch(90% 0.006 260)'}`, borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', opacity: isDone ? 0.85 : 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}>{campaign.name}</div>
          <div style={{ fontSize: '11.5px', color: 'oklch(52% 0.012 260)', marginTop: '2px' }}>
            {campaign.description || 'Revue des accès'}
          </div>
        </div>
        <Pill variant={statusPill.variant}>{statusPill.label}</Pill>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'oklch(52% 0.012 260)' }}>
          <span>Progression</span><span>{progress}%</span>
        </div>
        <div style={{ height: '6px', background: 'oklch(90% 0.006 260)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '999px', background: progressColor, width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ fontSize: '11.5px', color: 'oklch(52% 0.012 260)' }}>
          <strong style={{ color: 'oklch(18% 0.02 260)', fontWeight: 600 }}>{campaign.completedItems}</strong> / {campaign.totalItems} décisions prises
        </div>
        {isDone
          ? <div style={{ fontSize: '11.5px', color: 'oklch(62% 0.16 155)', fontWeight: 600 }}>Terminée</div>
          : <div style={{ fontSize: '11.5px', color: 'oklch(52% 0.012 260)' }}><strong style={{ color: 'oklch(18% 0.02 260)', fontWeight: 600 }}>{campaign.pendingItems}</strong> restantes</div>
        }
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {deadlineText && <div style={{ fontSize: '11.5px', fontWeight: 600 }} className={deadlineClass}>{deadlineText}</div>}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onView}
            style={{ background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', padding: '5px 10px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.12s, color 0.12s, border-color 0.12s', whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(42% 0.18 280 / 0.12)'; e.currentTarget.style.color = 'oklch(42% 0.18 280)'; e.currentTarget.style.borderColor = 'oklch(42% 0.18 280)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'oklch(52% 0.012 260)'; e.currentTarget.style.borderColor = 'oklch(90% 0.006 260)'; }}>
            Voir les décisions
          </button>
          {!isDone && onComplete && (
            <button onClick={onComplete}
              style={{ background: 'transparent', color: 'oklch(62% 0.16 155)', border: '1px solid oklch(62% 0.16 155 / 0.4)', padding: '5px 10px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.12s', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(62% 0.16 155 / 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              Clôturer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ───
export function Revues({ members, platforms }: RevuesProps) {
  const [tab, setTab] = useState<'active' | 'history' | 'my-decisions'>('active');
  const [campaigns, setCampaigns] = useState<ReviewCampaign[]>([]);
  const [allItems, setAllItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api.reviews.list().then(async (campaigns) => {
      setCampaigns(campaigns);
      // Fetch items for all active campaigns to populate pending decisions
      const activeCampaignIds = campaigns.filter((c) => c.status === 'active').map((c) => c.id);
      const itemArrays = await Promise.all(activeCampaignIds.map((id) => api.reviews.get(id).then((r) => r.items)));
      setAllItems(itemArrays.flat());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreated = (c: ReviewCampaign) => {
    setCampaigns((prev) => [c, ...prev]);
    setShowCreate(false);
  };

  const handleDecide = async (item: ReviewItem, decision: 'confirmed' | 'revoked') => {
    try {
      const updated = await api.reviews.decide(item.campaign_id, item.id, { decision });
      setAllItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      toast.success(decision === 'confirmed' ? 'Droit maintenu' : 'Droit révoqué');
    } catch {
      toast.error('Erreur lors de la décision');
    }
  };

  const handleBulk = async (campaignId: string, decision: 'confirmed' | 'revoked') => {
    const itemIds = allItems.filter((i) => i.campaign_id === campaignId && i.decision === 'pending').map((i) => i.id);
    if (itemIds.length === 0) return;
    try {
      const result = await api.reviews.bulk(campaignId, { itemIds, decision });
      // Refresh items for this campaign
      const updated = await api.reviews.get(campaignId);
      setAllItems((prev) => {
        const others = prev.filter((i) => i.campaign_id !== campaignId);
        return [...others, ...updated.items];
      });
      setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, completedItems: c.completedItems + result.processed, pendingItems: result.remaining } : c));
      toast.success(`${result.processed} décision${result.processed > 1 ? 's' : ''} enregistrée${result.processed > 1 ? 's' : ''}`);
    } catch {
      toast.error('Erreur lors du traitement groupé');
    }
  };

  const handleComplete = async (campaignId: string) => {
    try {
      await api.reviews.complete(campaignId);
      setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, status: 'completed', completed_at: new Date().toISOString() } : c));
      setAllItems((prev) => prev.filter((i) => i.campaign_id !== campaignId));
      toast.success('Campagne clôturée');
    } catch {
      toast.error('Erreur lors de la clôture');
    }
  };

  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const completedCampaigns = campaigns.filter((c) => c.status === 'completed' || c.status === 'cancelled');
  const totalPending = campaigns.reduce((s, c) => s + c.pendingItems, 0);
  const completionRate = campaigns.length > 0
    ? Math.round((campaigns.reduce((s, c) => s + c.completedItems, 0) / Math.max(1, campaigns.reduce((s, c) => s + c.totalItems, 0))) * 100)
    : 0;
  const totalRevoked = campaigns.reduce((s, c) => s + (c.totalItems - c.pendingItems - c.completedItems), 0);
  const pendingItems = allItems.filter((i) => i.decision === 'pending');

  const TABS = [
    { id: 'active' as const, label: 'Campagnes actives' },
    { id: 'history' as const, label: 'Historique' },
    { id: 'my-decisions' as const, label: 'Mes décisions en attente', badge: pendingItems.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Revues d'accès</div>
          <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>Certification des droits</div>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'filter 0.12s' }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.filter = '')}>
          <Plus className="w-[13px] h-[13px]" />
          Nouvelle campagne
        </button>
      </div>

      {/* KPI row — simple cards (no icon, colored value) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        {[
          { label: 'Campagnes actives', value: activeCampaigns.length, valueColor: 'oklch(42% 0.18 280)', delta: activeCampaigns.filter(c => c.due_date && new Date(c.due_date) < new Date()).length > 0 ? `dont ${activeCampaigns.filter(c => c.due_date && new Date(c.due_date) < new Date()).length} en retard` : 'En cours', deltaColor: 'oklch(52% 0.012 260)' },
          { label: 'En attente de décision', value: totalPending, valueColor: 'oklch(62% 0.18 52)', delta: 'Urgent', deltaColor: 'oklch(62% 0.18 52)' },
          { label: 'Taux de complétion', value: `${completionRate}%`, valueColor: 'oklch(70% 0.14 88)', delta: campaigns.length > 0 ? `${campaigns.reduce((s, c) => s + c.totalItems, 0)} droits au total` : 'Aucune campagne', deltaColor: 'oklch(52% 0.012 260)' },
          { label: 'Droits révoqués', value: totalRevoked, valueColor: 'oklch(62% 0.16 155)', delta: completedCampaigns.length > 0 ? `Sur ${completedCampaigns.length} campagne${completedCampaigns.length > 1 ? 's' : ''} clôturée${completedCampaigns.length > 1 ? 's' : ''}` : 'Aucune campagne clôturée', deltaColor: 'oklch(62% 0.16 155)' },
        ].map(({ label, value, valueColor, delta, deltaColor }) => (
          <div key={label} style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', padding: '18px 20px' }}>
            <div style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", letterSpacing: '-0.02em', color: valueColor }}>{value}</div>
            <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '5px', color: deltaColor }}>{delta}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', padding: '0 4px', borderBottom: '1px solid oklch(90% 0.006 260)', background: 'oklch(100% 0 0)', borderRadius: '10px 10px 0 0', border: '1px solid oklch(90% 0.006 260)', borderBottomWidth: '1px' }}>
          {TABS.map(({ id, label, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: tab === id ? 600 : 500,
                color: tab === id ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderBottom: `2px solid ${tab === id ? 'oklch(42% 0.18 280)' : 'transparent'}`,
                marginBottom: '-1px',
                transition: 'color 0.12s, border-color 0.12s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}>
              {label}
              {badge != null && badge > 0 && (
                <span style={{ background: 'oklch(62% 0.18 52)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab pane */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '20px' }}>

          {/* Tab: Campagnes actives */}
          {tab === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                  <Loader2 className="w-6 h-6 animate-spin text-[oklch(42%_0.18_280)]" />
                </div>
              ) : campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'oklch(52% 0.012 260)', fontSize: '13px' }}>
                  <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Aucune campagne. Lancez votre première campagne.
                </div>
              ) : (
                <>
                  {/* 3-column campaign grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
                    {campaigns.map((c) => (
                      <CampaignCard key={c.id} campaign={c}
                        onView={() => setTab('my-decisions')}
                        onComplete={c.status === 'active' ? () => handleComplete(c.id) : undefined}
                      />
                    ))}
                  </div>

                  {/* Pending decisions table */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Mes décisions en attente
                      {pendingItems.length > 0 && <Pill variant="high">{pendingItems.length} élément{pendingItems.length > 1 ? 's' : ''}</Pill>}
                    </div>
                    <PendingDecisionsTable
                      items={pendingItems}
                      members={members}
                      platforms={platforms}
                      onDecide={handleDecide}
                      onBulk={handleBulk}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Historique */}
          {tab === 'history' && (
            <div style={{ overflowX: 'auto' }}>
              {completedCampaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'oklch(52% 0.012 260)', fontSize: '13px' }}>
                  Aucune campagne terminée
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {['Campagne', 'Type', 'Lancée le', 'Clôturée le', 'Décisions', 'Révocations', 'Statut'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedCampaigns.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '11px 20px', fontWeight: 500, fontSize: '12.5px' }}>{c.name}</td>
                        <td style={{ padding: '11px 20px', fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>{c.description || 'Revue d\'accès'}</td>
                        <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
                          {c.completed_at ? new Date(c.completed_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
                          {c.completedItems} / {c.totalItems}
                        </td>
                        <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(55% 0.22 25)' }}>
                          —
                        </td>
                        <td style={{ padding: '11px 20px' }}>
                          <Pill variant={c.status === 'completed' ? 'low' : 'high'}>
                            {c.status === 'completed' ? 'Complétée' : 'Abandonnée'}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab: Mes décisions */}
          {tab === 'my-decisions' && (
            <PendingDecisionsTable
              items={pendingItems}
              members={members}
              platforms={platforms}
              onDecide={handleDecide}
              onBulk={handleBulk}
            />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateCampaignModal
          platforms={platforms}
          members={members}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
