// ═══════════════════════════════════════════
// Page Habilitations — Matrice croisée interactive
// ═══════════════════════════════════════════

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Search, FileText, RotateCcw, X, ChevronRight, Clock, UserCheck, UserX, Edit3,
  CheckCircle2, AlertTriangle, Loader2, CheckSquare, Square, ShieldOff, ShieldCheck,
} from 'lucide-react';
import { ACCESS_LEVEL_CONFIG, getRiskColor } from '@/types';
import type { AccessLevel, Member, Platform, AccessRight } from '@/types';
import { api } from '@/lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface HabilitationsProps {
  onUpdateAccess: (id: string, level: AccessLevel, comment?: string) => void;
  onRevokeAccess: (id: string, comment?: string) => void;
  members: Member[];
  platforms: Platform[];
  accessRights: AccessRight[];
}

export function Habilitations({ onUpdateAccess, onRevokeAccess, members, platforms, accessRights }: HabilitationsProps) {
  const navigate = useNavigate();
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('actif');
  const [showRisksOnly, setShowRisksOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ member: Member; platform: Platform; rightId: string; level: AccessLevel } | null>(null);
  const [editLevel, setEditLevel] = useState<AccessLevel>('none');
  const [editNote, setEditNote] = useState('');
  const [showRevue, setShowRevue] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const teams = useMemo(() => [...new Set(members.map((m) => m.team))], [members]);
  const activePlatforms = useMemo(() => platforms.filter((p) => p.status === 'actif'), [platforms]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (teamFilter !== 'all' && m.team !== teamFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (search && !m.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (showRisksOnly && m.risk_score > 60) return false;
      return true;
    }).sort((a, b) => b.risk_score - a.risk_score);
  }, [members, teamFilter, statusFilter, search, showRisksOnly]);

  const getAccessLevel = (memberId: string, platformId: string): AccessLevel => {
    const right = accessRights.find((a) => a.member_id === memberId && a.platform_id === platformId);
    return right ? right.level : 'none';
  };

  const handleCellClick = (member: Member, platform: Platform) => {
    const right = accessRights.find((a) => a.member_id === member.id && a.platform_id === platform.id);
    if (right) {
      setSelectedCell({ member, platform, rightId: right.id, level: right.level });
      setEditLevel(right.level);
      setEditNote('');
    }
  };

  const handleSave = () => {
    if (selectedCell) {
      onUpdateAccess(selectedCell.rightId, editLevel, editNote);
    }
    setSelectedCell(null);
  };

  const handleRevoke = () => {
    if (selectedCell) {
      onRevokeAccess(selectedCell.rightId, editNote || 'Révocation via matrice');
    }
    setSelectedCell(null);
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const handleBulkRevoke = async () => {
    const targetMembers = filteredMembers.filter((m) => selectedMembers.has(m.id));
    const rights = accessRights.filter(
      (a) => selectedMembers.has(a.member_id) && a.level !== 'none'
    );
    if (rights.length === 0) { toast.info('Aucun accès actif à révoquer'); return; }
    if (!confirm(`Révoquer ${rights.length} droit(s) pour ${targetMembers.length} membre(s) ?`)) return;
    setBulkLoading(true);
    let done = 0;
    for (const right of rights) {
      try {
        await api.accessRights.revoke(right.id, 'Révocation en masse');
        onRevokeAccess(right.id, 'Révocation en masse');
        done++;
      } catch { /* continue */ }
    }
    setBulkLoading(false);
    setSelectedMembers(new Set());
    toast.success(`${done} accès révoqué(s)`);
  };

  const handleBulkConfirmReview = async () => {
    const rights = accessRights.filter(
      (a) => selectedMembers.has(a.member_id) && a.level !== 'none'
    );
    if (rights.length === 0) { toast.info('Aucun accès actif'); return; }
    setBulkLoading(true);
    let done = 0;
    for (const right of rights) {
      try {
        await api.accessRights.updateLevel(right.id, right.level, 'Revue confirmée en masse');
        onUpdateAccess(right.id, right.level, 'Revue confirmée en masse');
        done++;
      } catch { /* continue */ }
    }
    setBulkLoading(false);
    setSelectedMembers(new Set());
    toast.success(`${done} accès confirmé(s)`);
  };

  const getCellDisplay = (memberId: string, platformId: string) => {
    const level = getAccessLevel(memberId, platformId);
    const cfg = ACCESS_LEVEL_CONFIG[level];
    return { level, cfg };
  };

  const selectedRight = selectedCell
    ? accessRights.find((a) => a.id === selectedCell.rightId)
    : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Matrice d'habilitation</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.length} membres × {activePlatforms.length} plateformes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRevue(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Lancer une revue
          </button>
          <button
            onClick={() => generateHabPDF(filteredMembers, activePlatforms, accessRights)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Rapport PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-48 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
            />
          </div>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
          >
            <option value="all">Toutes les équipes</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
          >
            <option value="all">Tous les niveaux</option>
            <option value="admin">Admin uniquement</option>
            <option value="rw">RW et plus</option>
            <option value="ro">RO et plus</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
          >
            <option value="actif">Actifs</option>
            <option value="all">Tous les statuts</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showRisksOnly}
              onChange={(e) => setShowRisksOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7]"
            />
            Masquer les accès vides
          </label>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px] border-r border-gray-200">
                  <div className="flex items-center gap-2">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-[#534AB7] transition-colors flex-shrink-0">
                      {selectedMembers.size === filteredMembers.length && filteredMembers.length > 0
                        ? <CheckSquare className="w-4 h-4 text-[#534AB7]" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                    <Shield className="w-4 h-4 text-[#534AB7]" />
                    Membre
                  </div>
                </th>
                {activePlatforms.map((p) => (
                  <th key={p.id} className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[100px] border-r border-gray-100 last:border-r-0">
                    <div className="text-xs">{p.name}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{p.category}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td
                    className={`sticky left-0 z-10 px-4 py-2.5 border-r border-gray-200 ${selectedMembers.has(member.id) ? 'bg-[#534AB7]/5' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleMemberSelection(member.id); }}
                        className="text-gray-400 hover:text-[#534AB7] transition-colors flex-shrink-0"
                      >
                        {selectedMembers.has(member.id)
                          ? <CheckSquare className="w-4 h-4 text-[#534AB7]" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>
                      <div
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                        onClick={() => navigate(`/membres/${member.id}`)}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getRiskColor(member.risk_score) }}
                        />
                        <div>
                          <div className="font-medium text-gray-900 text-xs">{member.full_name}</div>
                          <div className="text-[10px] text-gray-400">{member.team}</div>
                        </div>
                        <span
                          className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${getRiskColor(member.risk_score)}15`,
                            color: getRiskColor(member.risk_score),
                          }}
                        >
                          {member.risk_score}
                        </span>
                      </div>
                    </div>
                  </td>
                  {activePlatforms.map((platform) => {
                    const { level, cfg } = getCellDisplay(member.id, platform.id);
                    const isFiltered = levelFilter !== 'all' && level !== levelFilter && levelFilter === 'admin' && level !== 'admin';
                    if (isFiltered) return <td key={platform.id} className="px-3 py-2.5 border-r border-gray-100" />;

                    return (
                      <td
                        key={platform.id}
                        className="px-3 py-2.5 text-center border-r border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleCellClick(member, platform)}
                      >
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedMembers.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium">{selectedMembers.size} membre{selectedMembers.size > 1 ? 's' : ''} sélectionné{selectedMembers.size > 1 ? 's' : ''}</span>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleBulkConfirmReview}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Confirmer les accès
          </button>
          <button
            onClick={handleBulkRevoke}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
            Révoquer tout
          </button>
          <button
            onClick={() => setSelectedMembers(new Set())}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedCell && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedCell(null)} />
          <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white shadow-xl z-50 overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Détail de l'accès</h3>
              <button onClick={() => setSelectedCell(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Membre */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#534AB7] flex items-center justify-center text-white font-medium">
                  {selectedCell.member.full_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{selectedCell.member.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedCell.member.team} · {selectedCell.member.account_type}</p>
                </div>
                <button
                  onClick={() => { setSelectedCell(null); navigate(`/membres/${selectedCell.member.id}`); }}
                  className="ml-auto text-[#534AB7] hover:underline text-xs flex items-center gap-1"
                >
                  Fiche <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Plateforme */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Plateforme</p>
                <p className="font-medium text-sm text-gray-900">{selectedCell.platform.name}</p>
                <p className="text-xs text-gray-500">{selectedCell.platform.category} · {selectedCell.platform.access_type}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedCell.platform.has_mfa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedCell.platform.has_mfa ? 'MFA activé' : 'Pas de MFA'}
                  </span>
                </div>
              </div>

              {/* Current Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Niveau d'accès</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['admin', 'rw', 'ro', 'req', 'none'] as AccessLevel[]).map((l) => {
                    const cfg = ACCESS_LEVEL_CONFIG[l];
                    return (
                      <button
                        key={l}
                        onClick={() => setEditLevel(l)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${cfg.bg} ${cfg.text} ${
                          editLevel === l ? 'ring-2 ring-offset-1 ring-[#534AB7]' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Access Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Accordé le : {new Date(selectedRight?.granted_at || '').toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Attribué par : {selectedRight?.granted_by}</span>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
                  rows={2}
                  placeholder="Ajouter une note..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={editLevel === selectedCell.level}
                  className="flex-1 py-2.5 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Edit3 className="w-4 h-4 inline mr-1.5" />
                  Modifier
                </button>
                <button
                  onClick={handleRevoke}
                  className="flex-1 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <UserX className="w-4 h-4 inline mr-1.5" />
                  Révoquer
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showRevue && (
        <RevueModal
          accessRights={accessRights}
          members={members}
          platforms={platforms}
          onUpdateAccess={onUpdateAccess}
          onRevokeAccess={onRevokeAccess}
          onClose={() => setShowRevue(false)}
        />
      )}
    </div>
  );
}

// ─── Modal Revue d'accès ───

interface RevueModalProps {
  accessRights: AccessRight[];
  members: Member[];
  platforms: Platform[];
  onUpdateAccess: (id: string, level: AccessLevel, comment?: string) => void;
  onRevokeAccess: (id: string, comment?: string) => void;
  onClose: () => void;
}

type RevueDecision = 'confirmed' | 'downgraded' | 'revoked' | null;

interface RevueItem {
  right: AccessRight;
  member: Member;
  platform: Platform;
  decision: RevueDecision;
  newLevel: AccessLevel;
  saving: boolean;
  done: boolean;
}

function RevueModal({ accessRights, members, platforms, onUpdateAccess, onRevokeAccess, onClose }: RevueModalProps) {
  const overdueRights = useMemo(() => {
    const now = new Date();
    return accessRights.filter((a) =>
      a.level !== 'none' &&
      a.next_review_date &&
      new Date(a.next_review_date) < now
    );
  }, [accessRights]);

  const [items, setItems] = useState<RevueItem[]>(() =>
    overdueRights.map((right) => ({
      right,
      member: members.find((m) => m.id === right.member_id)!,
      platform: platforms.find((p) => p.id === right.platform_id)!,
      decision: null,
      newLevel: right.level,
      saving: false,
      done: false,
    })).filter((i) => i.member && i.platform)
  );

  const [submitting, setSubmitting] = useState(false);

  const setDecision = (idx: number, decision: RevueDecision, newLevel?: AccessLevel) => {
    setItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, decision, newLevel: newLevel ?? item.newLevel } : item
    ));
  };

  const pendingCount = items.filter((i) => i.decision === null && !i.done).length;
  const doneCount = items.filter((i) => i.done).length;

  const handleSubmitAll = async () => {
    const toProcess = items.filter((i) => i.decision !== null && !i.done);
    if (toProcess.length === 0) return;

    setSubmitting(true);
    for (const item of toProcess) {
      const idx = items.indexOf(item);
      setItems((prev) => prev.map((x, i) => i === idx ? { ...x, saving: true } : x));
      try {
        if (item.decision === 'revoked') {
          await api.accessRights.revoke(item.right.id, 'Révoqué lors de la revue d\'accès');
          onRevokeAccess(item.right.id, 'Révoqué lors de la revue d\'accès');
        } else {
          await api.accessRights.updateLevel(item.right.id, item.newLevel, `Revue d'accès — ${item.decision}`);
          onUpdateAccess(item.right.id, item.newLevel, `Revue d'accès — ${item.decision}`);
        }
        setItems((prev) => prev.map((x, i) => i === idx ? { ...x, saving: false, done: true } : x));
      } catch {
        setItems((prev) => prev.map((x, i) => i === idx ? { ...x, saving: false } : x));
        toast.error(`Erreur sur ${item.member.full_name} → ${item.platform.name}`);
      }
    }
    setSubmitting(false);
    toast.success(`${toProcess.length} accès traité${toProcess.length > 1 ? 's' : ''}`);
  };

  const decidedCount = items.filter((i) => i.decision !== null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#534AB7]" />
              Revue d'accès
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {overdueRights.length === 0
                ? 'Aucun accès en retard de revue'
                : `${overdueRights.length} accès en retard — ${pendingCount} restant${pendingCount > 1 ? 's' : ''}`
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Corps */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="font-semibold text-gray-800">Tous les accès sont à jour</p>
              <p className="text-sm text-gray-500 mt-1">Aucun accès n'est en retard de revue.</p>
            </div>
          )}

          {items.map((item, idx) => {
            const cfg = ACCESS_LEVEL_CONFIG[item.right.level];
            const daysSince = item.right.next_review_date
              ? Math.floor((Date.now() - new Date(item.right.next_review_date).getTime()) / 86400000)
              : 0;

            return (
              <div
                key={item.right.id}
                className={`rounded-xl border p-4 transition-all ${
                  item.done ? 'border-green-200 bg-green-50 opacity-60' :
                  item.decision === 'revoked' ? 'border-red-200 bg-red-50' :
                  item.decision !== null ? 'border-[#534AB7]/30 bg-[#534AB7]/5' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{item.member.full_name}</span>
                      <span className="text-gray-400 text-xs">→</span>
                      <span className="font-medium text-sm text-gray-700">{item.platform.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {daysSince}j de retard
                      </span>
                      <span>{item.member.team}</span>
                    </div>
                  </div>

                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : item.saving ? (
                    <Loader2 className="w-5 h-5 text-[#534AB7] animate-spin flex-shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => setDecision(idx, 'confirmed', item.right.level)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          item.decision === 'confirmed'
                            ? 'bg-green-500 text-white border-green-500'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        ✓ Confirmer
                      </button>

                      {/* Rétrograder vers niveau inférieur */}
                      {item.right.level !== 'ro' && item.right.level !== 'req' && item.right.level !== 'none' && (
                        <button
                          onClick={() => {
                            const lower: AccessLevel = item.right.level === 'admin' ? 'rw' : item.right.level === 'rw' ? 'ro' : 'req';
                            setDecision(idx, 'downgraded', lower);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            item.decision === 'downgraded'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          ↓ Rétrograder
                        </button>
                      )}

                      <button
                        onClick={() => setDecision(idx, 'revoked')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          item.decision === 'revoked'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-red-300 text-red-600 hover:bg-red-50'
                        }`}
                      >
                        ✕ Révoquer
                      </button>
                    </div>
                  )}
                </div>

                {item.decision === 'downgraded' && !item.done && (
                  <p className="text-xs text-amber-700 mt-2 pl-1">
                    Sera rétrogradé en <strong>{ACCESS_LEVEL_CONFIG[item.newLevel].label}</strong>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 p-4 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-sm text-gray-500">
              {doneCount > 0
                ? `${doneCount} traité${doneCount > 1 ? 's' : ''} · ${pendingCount} restant${pendingCount > 1 ? 's' : ''}`
                : `${decidedCount} décision${decidedCount > 1 ? 's' : ''} prête${decidedCount > 1 ? 's' : ''}`
              }
            </p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Fermer
              </button>
              <button
                onClick={handleSubmitAll}
                disabled={submitting || decidedCount === 0 || items.every((i) => i.done)}
                className="px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Valider {decidedCount > 0 ? `(${decidedCount})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function generateHabPDF(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const now = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(16);
  doc.text('Matrice d\'habilitation', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${now} · ${members.length} membres · ${platforms.length} plateformes`, 14, 22);
  doc.setTextColor(0);

  const headers = ['Membre', 'Équipe', ...platforms.map((p) => p.name.substring(0, 10))];
  const rows = members.map((m) => [
    m.full_name,
    m.team,
    ...platforms.map((p) => {
      const ar = accessRights.find((a) => a.member_id === m.id && a.platform_id === p.id && a.level !== 'none');
      return ar ? ACCESS_LEVEL_CONFIG[ar.level].label : '—';
    }),
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [83, 74, 183] },
  });

  doc.save('matrice-habilitations.pdf');
  toast.success('Rapport PDF téléchargé');
}
