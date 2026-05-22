// ═══════════════════════════════════════════
// Page Revues d'accès — Campagnes de revue
// ═══════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Plus, ChevronRight, CheckCircle2, XCircle,
  Clock, AlertTriangle, Loader2, X, Search, Shield,
  Users, Layers, ArrowRight, RotateCcw, CheckCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ACCESS_LEVEL_CONFIG } from '@/types';
import type { ReviewCampaign, ReviewItem, Member, Platform } from '@/types';

interface RevuesProps {
  members: Member[];
  platforms: Platform[];
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-[#534AB7]/10 flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-[#534AB7]" />
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30"
              placeholder="Ex: Revue annuelle Q1 2026" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description (optionnel)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30 resize-none"
              placeholder="Contexte ou instructions pour les reviewers…" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date limite (optionnel)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />Équipe (optionnel)
              </label>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30">
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
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30 h-20">
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {selectedPlatforms.length > 0 && <p className="text-[10px] text-[#534AB7] mt-0.5">{selectedPlatforms.length} sélectionnée(s)</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading || !name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {loading ? 'Création…' : 'Lancer la campagne'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Détail d'une campagne ───
function CampaignDetail({ campaign, members, platforms, onBack, onUpdated }: {
  campaign: ReviewCampaign;
  members: Member[];
  platforms: Platform[];
  onBack: () => void;
  onUpdated: (c: ReviewCampaign) => void;
}) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editItem, setEditItem] = useState<ReviewItem | null>(null);
  const [editLevel, setEditLevel] = useState('');
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    api.reviews.get(campaign.id).then((c) => { setItems(c.items); setLoading(false); });
  }, [campaign.id]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const platformById = useMemo(() => new Map(platforms.map((p) => [p.id, p])), [platforms]);

  const filtered = useMemo(() => items.filter((item) => {
    const m = memberById.get(item.member_id);
    const p = platformById.get(item.platform_id);
    if (search && !m?.full_name.toLowerCase().includes(search.toLowerCase()) && !p?.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'pending') return item.decision === 'pending';
    if (filter === 'done') return item.decision !== 'pending';
    return true;
  }), [items, search, filter, memberById, platformById]);

  const pendingItems = items.filter((i) => i.decision === 'pending');
  const progress = items.length > 0 ? Math.round(((items.length - pendingItems.length) / items.length) * 100) : 0;

  const decide = async (item: ReviewItem, decision: 'confirmed' | 'revoked' | 'modified', newLevel?: string, comment?: string) => {
    try {
      const updated = await api.reviews.decide(campaign.id, item.id, { decision, new_level: newLevel, comment });
      setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      setEditItem(null);
    } catch {
      toast.error('Erreur lors de la décision');
    }
  };

  const bulkDecide = async (decision: 'confirmed' | 'revoked') => {
    if (!selected.size) return;
    setBulkLoading(true);
    try {
      const res = await api.reviews.bulk(campaign.id, { itemIds: [...selected], decision });
      toast.success(`${res.processed} droits ${decision === 'confirmed' ? 'confirmés' : 'révoqués'}`);
      const fresh = await api.reviews.get(campaign.id);
      setItems(fresh.items);
      setSelected(new Set());
      if (res.remaining === 0) {
        toast.success('Campagne terminée !');
        onUpdated({ ...campaign, status: 'completed', pendingItems: 0, completedItems: campaign.totalItems });
      }
    } catch {
      toast.error('Erreur lors de l\'action en masse');
    } finally {
      setBulkLoading(false);
    }
  };

  const DECISION_CONFIG = {
    pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmé', color: 'bg-emerald-100 text-emerald-700' },
    revoked: { label: 'Révoqué', color: 'bg-red-100 text-red-700' },
    modified: { label: 'Modifié', color: 'bg-blue-100 text-blue-700' },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-0.5 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight className="w-4 h-4 text-gray-400 rotate-180" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${campaign.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : campaign.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-[#534AB7]/10 text-[#534AB7]'}`}>
              {campaign.status === 'completed' ? 'Terminée' : campaign.status === 'cancelled' ? 'Annulée' : 'En cours'}
            </span>
            {campaign.due_date && <span className="text-xs text-gray-400">Échéance : {new Date(campaign.due_date).toLocaleDateString('fr-FR')}</span>}
          </div>
          {campaign.description && <p className="text-sm text-gray-500 mt-0.5">{campaign.description}</p>}
        </div>
      </div>

      {/* Progression */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Progression</p>
          <p className="text-sm font-bold text-gray-900">{progress}%</p>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#534AB7] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" />{pendingItems.length} en attente</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{items.filter(i => i.decision === 'confirmed').length} confirmés</span>
          <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{items.filter(i => i.decision === 'revoked').length} révoqués</span>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher membre ou plateforme…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-full focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none" />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === f ? 'bg-[#534AB7] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : 'Traités'}
            </button>
          ))}
        </div>
        {selected.size > 0 && campaign.status === 'active' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{selected.size} sélectionné(s)</span>
            <button onClick={() => bulkDecide('confirmed')} disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />} Confirmer tout
            </button>
            <button onClick={() => bulkDecide('revoked')} disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Révoquer tout
            </button>
          </div>
        )}
      </div>

      {/* Liste des items */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#534AB7]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {campaign.status === 'active' && (
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox"
                      checked={selected.size === filtered.filter(i => i.decision === 'pending').length && filtered.filter(i => i.decision === 'pending').length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(new Set(filtered.filter(i => i.decision === 'pending').map(i => i.id)));
                        else setSelected(new Set());
                      }}
                      className="rounded" />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Membre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Plateforme</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Niveau actuel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Décision</th>
                {campaign.status === 'active' && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const m = memberById.get(item.member_id);
                const p = platformById.get(item.platform_id);
                const lvl = ACCESS_LEVEL_CONFIG[item.original_level as keyof typeof ACCESS_LEVEL_CONFIG];
                const dec = DECISION_CONFIG[item.decision];
                return (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    {campaign.status === 'active' && (
                      <td className="px-4 py-3">
                        {item.decision === 'pending' && (
                          <input type="checkbox" checked={selected.has(item.id)}
                            onChange={(e) => {
                              setSelected((prev) => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n; });
                            }} className="rounded" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{m?.full_name ?? item.member_id}</p>
                      <p className="text-xs text-gray-400">{m?.team}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p?.name ?? item.platform_id}</td>
                    <td className="px-4 py-3">
                      {lvl && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lvl.bg} ${lvl.text}`}>{lvl.label}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dec.color}`}>{dec.label}</span>
                      {item.decision === 'modified' && item.new_level && (
                        <span className="ml-1 text-[10px] text-gray-400">→ {item.new_level}</span>
                      )}
                      {item.comment && <p className="text-[10px] text-gray-400 mt-0.5 italic">"{item.comment}"</p>}
                    </td>
                    {campaign.status === 'active' && (
                      <td className="px-4 py-3 text-right">
                        {item.decision === 'pending' && (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => decide(item, 'confirmed')}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors" title="Confirmer">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setEditItem(item); setEditLevel(item.original_level); setEditComment(''); }}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors" title="Modifier le niveau">
                              <Shield className="w-4 h-4" />
                            </button>
                            <button onClick={() => decide(item, 'revoked')}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" title="Révoquer">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {item.decision !== 'pending' && (
                          <button onClick={() => decide({ ...item, decision: 'pending' } as ReviewItem, 'confirmed')}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Réinitialiser">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Aucun élément</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de modification de niveau */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Modifier le niveau d'accès</p>
              <button onClick={() => setEditItem(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500">{memberById.get(editItem.member_id)?.full_name} → {platformById.get(editItem.platform_id)?.name}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nouveau niveau</label>
              <select value={editLevel} onChange={(e) => setEditLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none">
                {['admin', 'rw', 'ro', 'req'].map((l) => (
                  <option key={l} value={l}>{ACCESS_LEVEL_CONFIG[l as keyof typeof ACCESS_LEVEL_CONFIG]?.label ?? l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Commentaire (optionnel)</label>
              <input value={editComment} onChange={(e) => setEditComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                placeholder="Raison de la modification…" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditItem(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={() => decide(editItem, 'modified', editLevel, editComment)}
                className="flex-1 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-bold hover:bg-[#3C3489]">
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ───
export function Revues({ members, platforms }: RevuesProps) {
  const [campaigns, setCampaigns] = useState<ReviewCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<ReviewCampaign | null>(null);

  useEffect(() => {
    api.reviews.list().then((c) => { setCampaigns(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleCreated = (c: ReviewCampaign) => {
    setCampaigns((prev) => [c, ...prev]);
    setShowCreate(false);
    setSelectedCampaign(c);
  };

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        members={members}
        platforms={platforms}
        onBack={() => setSelectedCampaign(null)}
        onUpdated={(c) => { setSelectedCampaign(c); setCampaigns((prev) => prev.map((x) => x.id === c.id ? c : x)); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revues d'accès</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lancez des campagnes pour valider ou révoquer les droits</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] transition-colors">
          <Plus className="w-4 h-4" /> Nouvelle campagne
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#534AB7]" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#534AB7]/10 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-[#534AB7]" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Aucune campagne de revue</h3>
          <p className="text-sm text-gray-400 mb-5">Lancez votre première campagne pour auditer les droits d'accès de votre organisation.</p>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489]">
            <Plus className="w-4 h-4" /> Lancer une campagne
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const progress = c.totalItems > 0 ? Math.round((c.completedItems / c.totalItems) * 100) : 0;
            const isOverdue = c.due_date && c.status === 'active' && new Date(c.due_date) < new Date();
            return (
              <div key={c.id} onClick={() => setSelectedCampaign(c)}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-[#534AB7]/30 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : c.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-[#534AB7]/10 text-[#534AB7]'}`}>
                        {c.status === 'completed' ? 'Terminée' : c.status === 'cancelled' ? 'Annulée' : 'En cours'}
                      </span>
                      {isOverdue && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><AlertTriangle className="w-2.5 h-2.5" />En retard</span>}
                    </div>
                    {c.description && <p className="text-xs text-gray-400 mb-2 truncate">{c.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{c.totalItems} droits</span>
                      <span className="text-amber-600 font-medium">{c.pendingItems} en attente</span>
                      {c.due_date && <span>Échéance : {new Date(c.due_date).toLocaleDateString('fr-FR')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-900">{progress}%</p>
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                        <div className="h-full bg-[#534AB7] rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
