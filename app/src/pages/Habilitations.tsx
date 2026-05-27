// ═══════════════════════════════════════════
// Page Habilitations — Sidebar plateforme + table permissions
// ═══════════════════════════════════════════

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Search, FileText, RotateCcw, X, ChevronRight, Clock, UserCheck, UserX, Edit3,
  CheckCircle2, AlertTriangle, Loader2, Plus, Download,
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

// ─── Helpers ───
function Pill({ variant, children }: { variant: 'crit' | 'high' | 'med' | 'low' | 'brand' | 'neutral'; children: React.ReactNode }) {
  const s: Record<string, React.CSSProperties> = {
    crit:    { background: 'oklch(55% 0.22 25 / 0.1)',  color: 'oklch(55% 0.22 25)' },
    high:    { background: 'oklch(62% 0.18 52 / 0.1)',  color: 'oklch(62% 0.18 52)' },
    med:     { background: 'oklch(70% 0.14 88 / 0.1)',  color: 'oklch(70% 0.14 88)' },
    low:     { background: 'oklch(62% 0.16 155 / 0.1)', color: 'oklch(62% 0.16 155)' },
    brand:   { background: 'oklch(42% 0.18 280 / 0.12)', color: 'oklch(42% 0.18 280)' },
    neutral: { background: 'oklch(52% 0.012 260 / 0.1)', color: 'oklch(52% 0.012 260)' },
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', ...s[variant] }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {children}
    </span>
  );
}

function KpiCard({ label, value, delta, deltaDir, color, path }: { label: string; value: string | number; delta: string; deltaDir: 'up' | 'down' | 'neutral'; color: string; path: string }) {
  const deltaColor = deltaDir === 'up' ? 'oklch(62% 0.16 155)' : deltaDir === 'down' ? 'oklch(55% 0.22 25)' : 'oklch(52% 0.012 260)';
  return (
    <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color, borderRadius: '10px 10px 0 0' }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '8px', background: color, opacity: 0.12 }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}><path d={path} /></svg>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: 'oklch(18% 0.02 260)' }}>{value}</div>
      <div style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: deltaColor }}>{delta}</div>
    </div>
  );
}

export function Habilitations({ onUpdateAccess, onRevokeAccess, members, platforms, accessRights }: HabilitationsProps) {
  const navigate = useNavigate();
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>(platforms[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [showRevue, setShowRevue] = useState(false);
  const [editRight, setEditRight] = useState<AccessRight | null>(null);
  const [editLevel, setEditLevel] = useState<AccessLevel>('ro');
  const [editNote, setEditNote] = useState('');
  const [showAttribuer, setShowAttribuer] = useState(false);
  const [attribMemberId, setAttribMemberId] = useState('');
  const [attribLevel, setAttribLevel] = useState<AccessLevel>('ro');
  const [attribNote, setAttribNote] = useState('');
  const [attribLoading, setAttribLoading] = useState(false);

  const activePlatforms = useMemo(() => platforms.filter((p) => p.status === 'actif'), [platforms]);

  const platformRights = useMemo(() => {
    if (!selectedPlatformId) return [];
    return accessRights.filter((a) => a.platform_id === selectedPlatformId && a.level !== 'none');
  }, [accessRights, selectedPlatformId]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filteredRights = useMemo(() => {
    return platformRights.filter((a) => {
      const m = memberById.get(a.member_id);
      if (search && !m?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (levelFilter !== 'all' && a.level !== levelFilter) return false;
      if (expiryFilter === 'expired' && a.next_review_date && new Date(a.next_review_date) >= new Date()) return false;
      if (expiryFilter === '7d') {
        const d = a.next_review_date ? new Date(a.next_review_date) : null;
        if (!d || d > new Date(Date.now() + 7 * 86400000)) return false;
      }
      if (expiryFilter === '30d') {
        const d = a.next_review_date ? new Date(a.next_review_date) : null;
        if (!d || d > new Date(Date.now() + 30 * 86400000)) return false;
      }
      return true;
    });
  }, [platformRights, search, levelFilter, expiryFilter, memberById]);

  const totalActive = accessRights.filter((a) => a.level !== 'none').length;
  const adminCount  = accessRights.filter((a) => a.level === 'admin').length;
  const soon30      = accessRights.filter((a) => {
    const d = a.next_review_date ? new Date(a.next_review_date) : null;
    return d && d > new Date() && d <= new Date(Date.now() + 30 * 86400000);
  }).length;

  const handleEdit = (right: AccessRight) => {
    setEditRight(right);
    setEditLevel(right.level);
    setEditNote('');
  };

  const handleSaveEdit = () => {
    if (!editRight) return;
    onUpdateAccess(editRight.id, editLevel, editNote || 'Modification via habilitations');
    setEditRight(null);
  };

  const handleRevoke = (right: AccessRight) => {
    onRevokeAccess(right.id, 'Révocation via habilitations');
  };

  const openAttribuer = () => {
    setAttribMemberId('');
    setAttribLevel('ro');
    setAttribNote('');
    setShowAttribuer(true);
  };

  const handleSaveAttribuer = async () => {
    if (!attribMemberId || !selectedPlatformId) return;
    setAttribLoading(true);
    try {
      await api.accessRights.create({
        member_id: attribMemberId,
        platform_id: selectedPlatformId,
        level: attribLevel,
        granted_by: 'Manuel',
        comment: attribNote || undefined,
      });
      toast.success('Habilitation attribuée');
      setShowAttribuer(false);
      // Refresh the page data
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'attribution');
    } finally {
      setAttribLoading(false);
    }
  };

  const ROLE_MAP: Record<AccessLevel, { variant: 'crit' | 'high' | 'brand'; label: string }> = {
    admin: { variant: 'crit', label: 'Admin' },
    rw:    { variant: 'high', label: 'Opérateur' },
    ro:    { variant: 'brand', label: 'Lecteur' },
    req:   { variant: 'brand', label: 'Demande' },
    none:  { variant: 'brand', label: '—' },
  };

  const PERM_TAGS: Record<AccessLevel, { label: string; type: 'admin' | 'write' | 'read' }[]> = {
    admin: [{ label: 'AdminFull', type: 'admin' }, { label: 'Write', type: 'write' }, { label: 'Read', type: 'read' }],
    rw:    [{ label: 'Write', type: 'write' }, { label: 'Read', type: 'read' }],
    ro:    [{ label: 'Read', type: 'read' }],
    req:   [{ label: 'Request', type: 'read' }],
    none:  [],
  };

  const selectedPlatform = platforms.find((p) => p.id === selectedPlatformId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Habilitations</div>
          <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>Droits d'accès par plateforme</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => generateHabPDF(members, platforms, accessRights)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
            <Download style={{ width: '14px', height: '14px' }} />
            Exporter
          </button>
          <button onClick={openAttribuer}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
            <Plus style={{ width: '14px', height: '14px' }} />
            Nouvelle habilitation
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Habilitations actives" value={totalActive.toLocaleString('fr-FR')} delta="→ Stable sur 30 j" deltaDir="neutral" color="oklch(42% 0.18 280)" path="M3 11h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V11z M7 11V7a5 5 0 0110 0v4" />
        <KpiCard label="Droits Admin" value={adminCount} delta={`↑ +${Math.max(0, adminCount - 200)} ce mois-ci`} deltaDir="down" color="oklch(55% 0.22 25)" path="M12 3L4 7v5c0 4.418 3.582 8 8 9 4.418-1 8-4.582 8-9V7l-8-4z" />
        <KpiCard label="À renouveler sous 30 j" value={soon30} delta={`Expirent avant 30/06`} deltaDir="neutral" color="oklch(70% 0.14 88)" path="M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2" />
        <KpiCard label="Plateformes couvertes" value={activePlatforms.length} delta={`↑ +${Math.max(0, activePlatforms.length - 16)} nouveaux services`} deltaDir="up" color="oklch(62% 0.16 155)" path="M2 3h20v14a2 2 0 01-2 2H4a2 2 0 01-2-2V3z M8 21h8 M12 17v4" />
      </div>

      {/* Main layout: platform list + permissions table */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Platform list */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Plateformes</span>
            <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)' }}>— {activePlatforms.length} services</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activePlatforms.map((p) => {
              const count = accessRights.filter((a) => a.platform_id === p.id && a.level !== 'none').length;
              const isSelected = p.id === selectedPlatformId;
              return (
                <div key={p.id} onClick={() => setSelectedPlatformId(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', borderBottom: '1px solid oklch(90% 0.006 260)', cursor: 'pointer', background: isSelected ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'oklch(97% 0.005 260)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '7px', background: isSelected ? 'oklch(42% 0.18 280 / 0.12)' : 'oklch(90% 0.006 260)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Shield style={{ width: '16px', height: '16px', color: isSelected ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)' }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500, flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: 'oklch(52% 0.012 260)' }}>{count.toLocaleString('fr-FR')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permissions table */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedPlatform?.name ?? '—'}</span>
            <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)' }}>— {platformRights.length} habilitations</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRevue(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }}>
                <RotateCcw style={{ width: '13px', height: '13px' }} />
                Révision de masse
              </button>
              <button onClick={openAttribuer} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }}>
                <Plus style={{ width: '13px', height: '13px' }} />
                Attribuer
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid oklch(90% 0.006 260)', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '160px', maxWidth: '280px' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'oklch(52% 0.012 260)', pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un membre…"
                style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(97% 0.005 260)', color: 'oklch(18% 0.02 260)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.12s' }} />
            </div>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value="all">Tous les niveaux</option>
              <option value="admin">Admin</option>
              <option value="rw">Écriture</option>
              <option value="ro">Lecture</option>
            </select>
            <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value="all">Toutes les expirations</option>
              <option value="7d">Expire sous 7 j</option>
              <option value="30d">Expire sous 30 j</option>
              <option value="expired">Expiré</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['', 'Membre', 'Rôle', 'Permissions', 'Accordé par', 'Expiration', 'Statut', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap' }}>
                      {h === '' && i === 0 ? <input type="checkbox" style={{ cursor: 'pointer' }} /> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRights.map((right) => {
                  const m = memberById.get(right.member_id);
                  if (!m) return null;
                  const role = ROLE_MAP[right.level];
                  const perms = PERM_TAGS[right.level] ?? [];
                  const isExpired = right.next_review_date && new Date(right.next_review_date) < new Date();
                  const expiresSoon = !isExpired && right.next_review_date && new Date(right.next_review_date) <= new Date(Date.now() + 30 * 86400000);
                  let statusPill: { variant: 'crit' | 'med' | 'low'; label: string };
                  if (isExpired) statusPill = { variant: 'crit', label: 'Expiré' };
                  else if (expiresSoon) statusPill = { variant: 'med', label: 'Expire bientôt' };
                  else statusPill = { variant: 'low', label: 'Actif' };

                  return (
                    <tr key={right.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '11px 20px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                      <td style={{ padding: '11px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'oklch(42% 0.18 280 / 0.12)', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 700, color: 'oklch(42% 0.18 280)', flexShrink: 0 }}>
                            {m.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{m.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 20px' }}><Pill variant={role.variant}>{role.label}</Pill></td>
                      <td style={{ padding: '11px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {perms.map(({ label, type }) => (
                            <span key={label} style={{
                              fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                              fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace",
                              background: type === 'admin' ? 'oklch(55% 0.22 25 / 0.1)' : type === 'write' ? 'oklch(42% 0.18 280 / 0.1)' : 'oklch(94% 0.005 260)',
                              color: type === 'admin' ? 'oklch(55% 0.22 25)' : type === 'write' ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)',
                            }}>{label}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
                        {right.granted_by || '—'}
                      </td>
                      <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '12px', color: isExpired ? 'oklch(55% 0.22 25)' : expiresSoon ? 'oklch(62% 0.18 52)' : 'oklch(52% 0.012 260)' }}>
                        {right.next_review_date ? new Date(right.next_review_date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ padding: '11px 20px' }}><Pill variant={statusPill.variant}>{statusPill.label}</Pill></td>
                      <td style={{ padding: '11px 20px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleEdit(right)} title="Modifier"
                            style={{ display: 'grid', placeItems: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid oklch(90% 0.006 260)', background: 'transparent', cursor: 'pointer', color: 'oklch(52% 0.012 260)', transition: 'all 0.12s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(42% 0.18 280 / 0.12)'; e.currentTarget.style.borderColor = 'oklch(42% 0.18 280)'; e.currentTarget.style.color = 'oklch(42% 0.18 280)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'oklch(90% 0.006 260)'; e.currentTarget.style.color = 'oklch(52% 0.012 260)'; }}>
                            <Edit3 style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button onClick={() => handleRevoke(right)} title="Révoquer"
                            style={{ display: 'grid', placeItems: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid oklch(90% 0.006 260)', background: 'transparent', cursor: 'pointer', color: 'oklch(55% 0.22 25)', transition: 'all 0.12s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(55% 0.22 25 / 0.08)'; e.currentTarget.style.borderColor = 'oklch(55% 0.22 25 / 0.3)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'oklch(90% 0.006 260)'; }}>
                            <X style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRights.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'oklch(52% 0.012 260)', fontSize: '13px' }}>
                      Aucune habilitation pour cette plateforme
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editRight && (() => {
        const m = memberById.get(editRight.member_id);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'oklch(0% 0 0 / 0.4)' }}>
            <div style={{ background: 'oklch(100% 0 0)', borderRadius: '10px', boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)', width: '100%', maxWidth: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Modifier le niveau d'accès</span>
                <button onClick={() => setEditRight(null)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X style={{ width: '16px', height: '16px', color: 'oklch(52% 0.012 260)' }} /></button>
              </div>
              <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>{m?.full_name} → {selectedPlatform?.name}</div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(52% 0.012 260)', marginBottom: '8px' }}>Nouveau niveau</label>
                <select value={editLevel} onChange={(e) => setEditLevel(e.target.value as AccessLevel)}
                  style={{ width: '100%', padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', outline: 'none', fontFamily: 'inherit' }}>
                  {(['admin', 'rw', 'ro', 'req'] as AccessLevel[]).map((l) => (
                    <option key={l} value={l}>{ACCESS_LEVEL_CONFIG[l].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(52% 0.012 260)', marginBottom: '8px' }}>Commentaire (optionnel)</label>
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)}
                  style={{ width: '100%', padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', outline: 'none', fontFamily: 'inherit' }}
                  placeholder="Raison de la modification…" />
              </div>
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button onClick={() => setEditRight(null)} style={{ flex: 1, padding: '8px 16px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '13px', color: 'oklch(52% 0.012 260)', background: 'transparent', cursor: 'pointer' }}>Annuler</button>
                <button onClick={handleSaveEdit} style={{ flex: 1, padding: '8px 16px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Appliquer</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modale Attribuer */}
      {showAttribuer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'oklch(0% 0 0 / 0.4)' }}>
          <div style={{ background: 'oklch(100% 0 0)', borderRadius: '10px', boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)', width: '100%', maxWidth: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Attribuer une habilitation</span>
              <button onClick={() => setShowAttribuer(false)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '16px', height: '16px', color: 'oklch(52% 0.012 260)' }} />
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
              Plateforme : <strong>{selectedPlatform?.name ?? '—'}</strong>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(52% 0.012 260)', marginBottom: '8px' }}>Membre *</label>
              <select value={attribMemberId} onChange={(e) => setAttribMemberId(e.target.value)}
                style={{ width: '100%', padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', outline: 'none', fontFamily: 'inherit' }}>
                <option value="">— Sélectionner un membre —</option>
                {members
                  .filter((m) => m.status === 'actif')
                  .filter((m) => !platformRights.some((r) => r.member_id === m.id))
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.team || m.email})</option>
                  ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(52% 0.012 260)', marginBottom: '8px' }}>Niveau d'accès *</label>
              <select value={attribLevel} onChange={(e) => setAttribLevel(e.target.value as AccessLevel)}
                style={{ width: '100%', padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', outline: 'none', fontFamily: 'inherit' }}>
                {(['admin', 'rw', 'ro', 'req'] as AccessLevel[]).map((l) => (
                  <option key={l} value={l}>{ACCESS_LEVEL_CONFIG[l].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'oklch(52% 0.012 260)', marginBottom: '8px' }}>Commentaire (optionnel)</label>
              <input value={attribNote} onChange={(e) => setAttribNote(e.target.value)}
                style={{ width: '100%', padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', outline: 'none', fontFamily: 'inherit' }}
                placeholder="Raison de l'attribution…" />
            </div>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button onClick={() => setShowAttribuer(false)}
                style={{ flex: 1, padding: '8px 16px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '13px', color: 'oklch(52% 0.012 260)', background: 'transparent', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleSaveAttribuer} disabled={!attribMemberId || attribLoading}
                style={{ flex: 1, padding: '8px 16px', background: !attribMemberId || attribLoading ? 'oklch(80% 0.01 260)' : 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: !attribMemberId || attribLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {attribLoading && <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />}
                Attribuer
              </button>
            </div>
          </div>
        </div>
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

// ─── Modal Revue d'accès (kept from original) ───
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
    return accessRights.filter((a) => a.level !== 'none' && a.next_review_date && new Date(a.next_review_date) < now);
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
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, decision, newLevel: newLevel ?? item.newLevel } : item));
  };

  const pendingCount = items.filter((i) => i.decision === null && !i.done).length;
  const doneCount    = items.filter((i) => i.done).length;
  const decidedCount = items.filter((i) => i.decision !== null).length;

  const handleSubmitAll = async () => {
    const toProcess = items.filter((i) => i.decision !== null && !i.done);
    if (toProcess.length === 0) return;
    setSubmitting(true);
    for (const item of toProcess) {
      const idx = items.indexOf(item);
      setItems((prev) => prev.map((x, i) => i === idx ? { ...x, saving: true } : x));
      try {
        if (item.decision === 'revoked') {
          await api.accessRights.revoke(item.right.id, "Révoqué lors de la revue d'accès");
          onRevokeAccess(item.right.id, "Révoqué lors de la revue d'accès");
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'oklch(0% 0 0 / 0.4)' }}>
      <div style={{ background: 'oklch(100% 0 0)', borderRadius: '10px', boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)', width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Revue d'accès</div>
            <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)', marginTop: '2px' }}>
              {overdueRights.length === 0 ? 'Aucun accès en retard' : `${overdueRights.length} accès en retard — ${pendingCount} restant${pendingCount > 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X style={{ width: '16px', height: '16px', color: 'oklch(52% 0.012 260)' }} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <CheckCircle2 style={{ width: '48px', height: '48px', color: 'oklch(62% 0.16 155)', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Tous les accès sont à jour</div>
            </div>
          )}
          {items.map((item, idx) => {
            const cfg = ACCESS_LEVEL_CONFIG[item.right.level];
            const daysSince = item.right.next_review_date ? Math.floor((Date.now() - new Date(item.right.next_review_date).getTime()) / 86400000) : 0;
            return (
              <div key={item.right.id} style={{ border: `1px solid ${item.done ? 'oklch(62% 0.16 155 / 0.3)' : item.decision === 'revoked' ? 'oklch(55% 0.22 25 / 0.3)' : item.decision !== null ? 'oklch(42% 0.18 280 / 0.3)' : 'oklch(90% 0.006 260)'}`, borderRadius: '10px', padding: '16px', background: item.done ? 'oklch(62% 0.16 155 / 0.05)' : item.decision === 'revoked' ? 'oklch(55% 0.22 25 / 0.05)' : item.decision !== null ? 'oklch(42% 0.18 280 / 0.05)' : 'oklch(100% 0 0)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.member.full_name} → {item.platform.name}</div>
                    <div style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'oklch(55% 0.22 25)', fontWeight: 600 }}>{daysSince}j de retard</span>
                      <span>{item.member.team}</span>
                    </div>
                  </div>
                  {item.done ? <CheckCircle2 style={{ width: '20px', height: '20px', color: 'oklch(62% 0.16 155)', flexShrink: 0 }} /> :
                   item.saving ? <Loader2 style={{ width: '20px', height: '20px', color: 'oklch(42% 0.18 280)', flexShrink: 0 }} className="animate-spin" /> : (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button onClick={() => setDecision(idx, 'confirmed', item.right.level)}
                        style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500, border: `1px solid ${item.decision === 'confirmed' ? 'transparent' : 'oklch(62% 0.16 155 / 0.4)'}`, background: item.decision === 'confirmed' ? 'oklch(62% 0.16 155)' : 'transparent', color: item.decision === 'confirmed' ? '#fff' : 'oklch(62% 0.16 155)', cursor: 'pointer' }}>
                        ✓ Confirmer
                      </button>
                      <button onClick={() => setDecision(idx, 'revoked')}
                        style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500, border: `1px solid ${item.decision === 'revoked' ? 'transparent' : 'oklch(55% 0.22 25 / 0.4)'}`, background: item.decision === 'revoked' ? 'oklch(55% 0.22 25)' : 'transparent', color: item.decision === 'revoked' ? '#fff' : 'oklch(55% 0.22 25)', cursor: 'pointer' }}>
                        ✕ Révoquer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div style={{ borderTop: '1px solid oklch(90% 0.006 260)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'oklch(52% 0.012 260)' }}>
              {doneCount > 0 ? `${doneCount} traité${doneCount > 1 ? 's' : ''} · ${pendingCount} restant${pendingCount > 1 ? 's' : ''}` : `${decidedCount} décision${decidedCount > 1 ? 's' : ''} prête${decidedCount > 1 ? 's' : ''}`}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={{ padding: '7px 14px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '13px', color: 'oklch(52% 0.012 260)', background: 'transparent', cursor: 'pointer' }}>Fermer</button>
              <button onClick={handleSubmitAll} disabled={submitting || decidedCount === 0 || items.every((i) => i.done)}
                style={{ padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: submitting || decidedCount === 0 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {submitting && <Loader2 style={{ width: '14px', height: '14px' }} className="animate-spin" />}
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
  doc.text("Matrice d'habilitation", 14, 16);
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
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [83, 74, 183] },
  });

  doc.save(`habilitations-${now}.pdf`);
}
