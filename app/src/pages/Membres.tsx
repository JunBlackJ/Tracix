// ═══════════════════════════════════════════
// Page Membres — Liste, fiche détail et édition
// ═══════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, ArrowLeft, Shield, AlertTriangle,
  ChevronRight, TrendingUp, Edit2, X, Save, Loader2, ShieldAlert, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { ACCESS_LEVEL_CONFIG, SEVERITY_CONFIG } from '@/types';
import type { Member, Platform, Alert, AccessRight, AccountType, MemberStatus, AccessLevel } from '@/types';
import { RiskBadge, RiskGauge } from '@/components/ui/RiskBadge';
import { toast } from 'sonner';

interface MembresProps {
  onRevokeAccess: (id: string, comment?: string) => void;
  onUpdateAccess: (id: string, level: AccessLevel, comment?: string) => void;
  members: Member[];
  platforms: Platform[];
  alerts: Alert[];
  categories?: import('@/types').Category[];
  onMemberUpdated?: (member: Member) => void;
  onMemberCreated?: (member: Member) => void;
}

export function Membres({ onRevokeAccess, onUpdateAccess, members, platforms, alerts, categories = [], onMemberUpdated, onMemberCreated }: MembresProps) {
  const { id } = useParams<{ id: string }>();
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const handleCreated = (m: Member) => {
    setShowForm(false);
    setEditingMember(null);
    onMemberCreated?.(m);
  };

  const handleUpdated = (m: Member) => {
    setShowForm(false);
    setEditingMember(null);
    onMemberUpdated?.(m);
  };

  return (
    <>
      {id ? (
        <MembreDetail
          memberId={id}
          onRevokeAccess={onRevokeAccess}
          onUpdateAccess={onUpdateAccess}
          members={members}
          platforms={platforms}
          alerts={alerts}
          onEdit={(m) => { setEditingMember(m); setShowForm(true); }}
        />
      ) : (
        <MembresList
          members={members}
          onNew={() => { setEditingMember(null); setShowForm(true); }}
        />
      )}
      {showForm && (
        <MemberFormModal
          member={editingMember}
          teamCategories={categories}
          onClose={() => { setShowForm(false); setEditingMember(null); }}
          onSaved={editingMember ? handleUpdated : handleCreated}
        />
      )}
    </>
  );
}

// ─── Liste ───

function MembresList({ members, onNew }: { members: Member[]; onNew: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const teams = [...new Set(members.map((m) => m.team))];

  const filtered = members
    .filter((m) => {
      if (search && !m.full_name.toLowerCase().includes(search.toLowerCase())
        && !m.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter !== 'all' && m.team !== teamFilter) return false;
      if (typeFilter !== 'all' && m.account_type !== typeFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => a.risk_score - b.risk_score);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Membres</h1>
          <p className="text-sm text-gray-500">{members.length} membres dans l'organisation</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const ws = XLSX.utils.json_to_sheet(members.map((m) => ({
                Nom: m.full_name, Email: m.email, Équipe: m.team,
                Type: m.account_type, Statut: m.status, 'Score risque': m.risk_score,
              })));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Membres');
              XLSX.writeFile(wb, 'membres.xlsx');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau membre
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou email..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-56 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
          />
        </div>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#534AB7]/20 outline-none">
          <option value="all">Toutes les équipes</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#534AB7]/20 outline-none">
          <option value="all">Tous les types</option>
          <option value="privilégié">Privilégié</option>
          <option value="nominatif">Nominatif</option>
          <option value="service">Service</option>
          <option value="partagé">Partagé</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#534AB7]/20 outline-none">
          <option value="all">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
          <option value="suspendu">Suspendu</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Membre</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Équipe</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Statut</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Score risque</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/membres/${m.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                      {m.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{m.full_name}</p>
                      <p className="text-[11px] text-gray-400">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.team}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.account_type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    m.status === 'actif' ? 'bg-green-100 text-green-700'
                    : m.status === 'suspendu' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <RiskBadge score={m.risk_score} size="md" showLabel />
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucun membre ne correspond aux filtres
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Fiche détail ───

interface MembreDetailProps {
  memberId: string;
  onRevokeAccess: (id: string, comment?: string) => void;
  onUpdateAccess: (id: string, level: AccessLevel, comment?: string) => void;
  members: Member[];
  platforms: Platform[];
  alerts: Alert[];
  onEdit: (m: Member) => void;
}

function MembreDetail({ memberId, onRevokeAccess, onUpdateAccess, members, platforms, alerts, onEdit }: MembreDetailProps) {
  const navigate = useNavigate();
  const member = members.find((m) => m.id === memberId);
  if (!member) return <div className="p-8 text-gray-400">Membre non trouvé</div>;

  const memberAlerts = alerts.filter((a) => a.source_id === memberId && !a.is_resolved);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/membres')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {member.full_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{member.full_name}</h1>
              <p className="text-sm text-gray-500 truncate">{member.username} · {member.team} · {member.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{member.account_type}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  member.status === 'actif' ? 'bg-green-100 text-green-700'
                  : member.status === 'suspendu' ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {member.status}
                </span>
                {member.departure_date && (
                  <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Départ : {new Date(member.departure_date).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              {member.notes && (
                <p className="text-xs text-gray-400 mt-2 italic">{member.notes}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <RiskGauge score={member.risk_score} size="lg" />
            <button
              onClick={() => onEdit(member)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:border-[#534AB7] hover:text-[#534AB7] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Modifier
            </button>
          </div>
        </div>

        {/* Risk factors */}
        {member.risk_factors.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#534AB7]" />
              Facteurs de risque
            </h3>
            <div className="flex flex-wrap gap-2">
              {member.risk_factors.map((f, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium ${
                    f.delta < 0 ? 'bg-red-50 text-red-700 border border-red-100'
                    : f.delta === 0 ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}
                >
                  {f.delta !== 0 && (
                    <span className="font-bold">{f.delta > 0 ? `+${f.delta}` : f.delta}</span>
                  )}
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Access table */}
      <MemberAccessTable
        memberId={memberId}
        member={member}
        platforms={platforms}
        onRevokeAccess={onRevokeAccess}
        onUpdateAccess={onUpdateAccess}
      />

      {/* Alerts */}
      {memberAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alertes actives ({memberAlerts.length})
          </h3>
          <div className="space-y-2">
            {memberAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <div key={alert.id} className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <p className={`text-[11px] font-bold uppercase ${cfg.text}`}>{cfg.label}</p>
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

// ─── Table d'accès ───

interface MemberAccessTableProps {
  memberId: string;
  member: Member;
  platforms: Platform[];
  onRevokeAccess: (id: string, comment?: string) => void;
  onUpdateAccess: (id: string, level: AccessLevel, comment?: string) => void;
}

type PendingAction =
  | { type: 'revoke'; accessRight: AccessRight; platformName: string }
  | { type: 'change'; accessRight: AccessRight; newLevel: AccessLevel; platformName: string };

function MemberAccessTable({ memberId, member, platforms, onRevokeAccess, onUpdateAccess }: MemberAccessTableProps) {
  const [accessRights, setAccessRights] = useState<AccessRight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api.accessRights.list({ member_id: memberId })
      .then((data) => { setAccessRights(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [memberId]);

  // Close menu on outside click
  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [actionMenu]);

  const requestRevoke = (a: AccessRight) => {
    const platformName = platforms.find((p) => p.id === a.platform_id)?.name ?? a.platform_id;
    setActionMenu(null);
    setPending({ type: 'revoke', accessRight: a, platformName });
  };

  const requestChangeLevel = (a: AccessRight, level: AccessLevel) => {
    const platformName = platforms.find((p) => p.id === a.platform_id)?.name ?? a.platform_id;
    setActionMenu(null);
    setPending({ type: 'change', accessRight: a, newLevel: level, platformName });
  };

  const executeAction = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      if (pending.type === 'revoke') {
        onRevokeAccess(pending.accessRight.id, `Révocation depuis fiche ${member.full_name}`);
        setAccessRights((prev) => prev.map((x) => x.id === pending.accessRight.id ? { ...x, level: 'none' as AccessLevel } : x));
        toast.success(`Accès révoqué sur ${pending.platformName}`);
      } else {
        onUpdateAccess(pending.accessRight.id, pending.newLevel, `Modification depuis fiche ${member.full_name}`);
        setAccessRights((prev) => prev.map((x) => x.id === pending.accessRight.id ? { ...x, level: pending.newLevel } : x));
        toast.success(`Niveau modifié sur ${pending.platformName}`);
      }
    } finally {
      setConfirming(false);
      setPending(null);
    }
  };

  if (!loaded) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
    </div>
  );

  const activeAccess = accessRights.filter((a) => a.level !== 'none');

  return (
    <>
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#534AB7]" />
        Accès actifs ({activeAccess.length} / {accessRights.length} plateformes)
      </h3>
      {accessRights.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun droit d'accès trouvé</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-600">Plateforme</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Niveau</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Accordé le</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Par</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Dernière revue</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Prochaine revue</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {accessRights.map((a) => {
              const platform = platforms.find((p) => p.id === a.platform_id);
              const cfg = ACCESS_LEVEL_CONFIG[a.level];
              const isOverdue = a.next_review_date && new Date(a.next_review_date) < new Date();
              const isOpen = actionMenu === a.id;
              return (
                <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${a.level === 'none' ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{platform?.name || a.platform_id}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{a.granted_at ? new Date(a.granted_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{a.granted_by || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{a.last_review_date ? new Date(a.last_review_date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                      {a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('fr-FR') : '—'}
                      {isOverdue && ' ⚠'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {a.level !== 'none' && (
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionMenu(isOpen ? null : a.id); }}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-[#534AB7] hover:text-[#534AB7] transition-colors font-medium"
                        >
                          Action ▾
                        </button>
                        {isOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-52 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Changer le niveau</p>
                            {(['admin', 'rw', 'ro', 'req'] as AccessLevel[])
                              .filter((lvl) => lvl !== a.level)
                              .map((lvl) => {
                                const lcfg = ACCESS_LEVEL_CONFIG[lvl];
                                return (
                                  <button
                                    key={lvl}
                                    onClick={() => requestChangeLevel(a, lvl)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${lcfg.bg} ${lcfg.text}`}>{lcfg.label}</span>
                                    <span>Passer en {lvl === 'admin' ? 'Administrateur' : lvl === 'rw' ? 'Lecture / Écriture' : lvl === 'ro' ? 'Lecture seule' : 'Sur demande'}</span>
                                  </button>
                                );
                              })}
                            <div className="border-t border-gray-100 mt-1" />
                            <button
                              onClick={() => requestRevoke(a)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                            >
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-700">✕</span>
                              Révoquer l'accès
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>

    {/* ─── Modale de confirmation ─── */}
    {pending && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => !confirming && setPending(null)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

          {/* Bandeau d'avertissement */}
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Action requise sur la plateforme</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Avant de valider ici, assurez-vous d'avoir déjà effectué cette modification directement
                sur <span className="font-semibold">{pending.platformName}</span>.
              </p>
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* Résumé de l'action */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action à enregistrer</p>
              {pending.type === 'revoke' ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-600">Révoquer l'accès</span>
                  <span className="text-sm text-gray-500">de <span className="font-medium text-gray-800">{member.full_name}</span> sur</span>
                  <span className="text-sm font-bold text-gray-900">{pending.platformName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-500">Changer le niveau de</span>
                  <span className="text-sm font-bold text-gray-900">{member.full_name}</span>
                  <span className="text-sm text-gray-500">sur <span className="font-bold text-gray-900">{pending.platformName}</span> →</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${ACCESS_LEVEL_CONFIG[pending.newLevel].bg} ${ACCESS_LEVEL_CONFIG[pending.newLevel].text}`}>
                    {ACCESS_LEVEL_CONFIG[pending.newLevel].label}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Tracix enregistre uniquement ce qui a été fait. Si vous n'avez pas encore modifié les droits
              sur <span className="font-semibold">{pending.platformName}</span>, annulez et effectuez la modification là-bas en premier.
            </p>
          </div>

          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={() => setPending(null)}
              disabled={confirming}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuler — je n'ai pas encore fait la modif
            </button>
            <button
              onClick={executeAction}
              disabled={confirming}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                pending.type === 'revoke'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#534AB7] hover:bg-[#3C3489] text-white'
              }`}
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {confirming ? 'Enregistrement…' : 'Oui, c\'est fait — enregistrer'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Formulaire création/édition ───

interface MemberFormModalProps {
  member: Member | null;
  teamCategories: import('@/types').Category[];
  onClose: () => void;
  onSaved: (m: Member) => void;
}

function MemberFormModal({ member, teamCategories, onClose, onSaved }: MemberFormModalProps) {
  const isEdit = !!member;

  const [form, setForm] = useState({
    full_name: member?.full_name ?? '',
    username: member?.username ?? '',
    email: member?.email ?? '',
    team: member?.team ?? '',
    account_type: (member?.account_type ?? 'nominatif') as AccountType,
    status: (member?.status ?? 'actif') as MemberStatus,
    departure_date: member?.departure_date ?? '',
    notes: member?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.full_name.trim()) e.full_name = 'Requis';
    if (!form.username.trim()) e.username = 'Requis';
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = 'Email invalide';
    if (!form.team.trim()) e.team = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        departure_date: form.departure_date || null,
      };
      const saved = isEdit
        ? await api.members.update(member!.id, payload)
        : await api.members.create(payload);
      toast.success(isEdit ? 'Membre modifié avec succès' : 'Membre créé avec succès');
      onSaved(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Erreur : ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const field = (id: keyof typeof form) => ({
    value: form[id] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [id]: e.target.value })),
  });

  const inputClass = (id: keyof typeof form) =>
    `w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none ${
      errors[id] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Modifier — ${member!.full_name}` : 'Nouveau membre'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Nom + Username */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom complet *</label>
              <input {...field('full_name')} className={inputClass('full_name')} placeholder="Ex: Marie Dupont" />
              {errors.full_name && <p className="text-[11px] text-red-500 mt-0.5">{errors.full_name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Identifiant *</label>
              <input {...field('username')} className={inputClass('username')} placeholder="Ex: marie.d" />
              {errors.username && <p className="text-[11px] text-red-500 mt-0.5">{errors.username}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
            <input {...field('email')} type="email" className={inputClass('email')} placeholder="marie@entreprise.io" />
            {errors.email && <p className="text-[11px] text-red-500 mt-0.5">{errors.email}</p>}
          </div>

          {/* Équipe */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Équipe *</label>
            {teamCategories.length > 0 ? (
              <select {...field('team')} className={inputClass('team')}>
                <option value="">— Sélectionner une équipe —</option>
                {teamCategories.map((c) => (
                  <option key={c.id} value={c.label}>{c.label}</option>
                ))}
              </select>
            ) : (
              <input {...field('team')} className={inputClass('team')} placeholder="Ex: Devs_mobile, Sécurité, Non-Tech…" />
            )}
            {teamCategories.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">Ajoutez des équipes dans Paramètres → Catégories</p>
            )}
            {errors.team && <p className="text-[11px] text-red-500 mt-0.5">{errors.team}</p>}
          </div>

          {/* Type + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type de compte</label>
              <select {...field('account_type')} className={inputClass('account_type')}>
                <option value="nominatif">Nominatif</option>
                <option value="privilégié">Privilégié</option>
                <option value="service">Service</option>
                <option value="partagé">Partagé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Statut</label>
              <select {...field('status')} className={inputClass('status')}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="suspendu">Suspendu</option>
              </select>
            </div>
          </div>

          {/* Date de départ */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Date de départ prévue</label>
            <input
              type="date"
              value={form.departure_date ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, departure_date: e.target.value || '' }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">Laisser vide si pas de départ prévu</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
              placeholder="Informations complémentaires…"
            />
          </div>

          {/* Risk notice */}
          <div className="bg-[#534AB7]/5 border border-[#534AB7]/20 rounded-lg p-3">
            <p className="text-[11px] text-[#534AB7]">
              Le score de risque sera recalculé automatiquement après la sauvegarde.
            </p>
          </div>

          {/* Actions */}
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
              {saving ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Créer le membre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
