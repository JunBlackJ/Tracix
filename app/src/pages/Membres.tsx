// ═══════════════════════════════════════════
// Page Membres — Liste, fiche détail et édition
// ═══════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, ArrowLeft, Shield, AlertTriangle,
  TrendingUp, Edit2, X, Save, Loader2, ShieldAlert, Download, UserX, Users,
} from 'lucide-react';
import { EmptyState, FilterEmpty } from '@/components/ui/EmptyState';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { ACCESS_LEVEL_CONFIG, SEVERITY_CONFIG } from '@/types';
import type { Member, Platform, Alert, AccessRight, AccountType, MemberStatus, AccessLevel } from '@/types';
import { RiskGauge } from '@/components/ui/RiskBadge';
import { toast } from 'sonner';

interface MembresProps {
  onRevokeAccess: (id: string, comment?: string) => void;
  onUpdateAccess: (id: string, level: AccessLevel, comment?: string) => void;
  members: Member[];
  platforms: Platform[];
  alerts: Alert[];
  accessRights?: AccessRight[];
  categories?: import('@/types').Category[];
  onMemberUpdated?: (member: Member) => void;
  onMemberCreated?: (member: Member) => void;
}

export function Membres({ onRevokeAccess, onUpdateAccess, members, platforms, alerts, accessRights = [], categories = [], onMemberUpdated, onMemberCreated }: MembresProps) {
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
          accessRights={accessRights}
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

// ─── Helpers ───

function scoreColor(s: number) {
  if (s >= 75) return 'oklch(55% 0.22 25)';
  if (s >= 50) return 'oklch(62% 0.18 52)';
  if (s >= 25) return 'oklch(70% 0.14 88)';
  return 'oklch(62% 0.16 155)';
}
function scoreBg(s: number) {
  if (s >= 75) return 'oklch(55% 0.22 25 / 0.12)';
  if (s >= 50) return 'oklch(62% 0.18 52 / 0.12)';
  if (s >= 25) return 'oklch(70% 0.14 88 / 0.12)';
  return 'oklch(62% 0.16 155 / 0.12)';
}
function statusStyle(s: MemberStatus): React.CSSProperties {
  if (s === 'actif') return { background: 'oklch(62% 0.16 155 / 0.1)', color: 'oklch(62% 0.16 155)' };
  if (s === 'suspendu') return { background: 'oklch(55% 0.22 25 / 0.08)', color: 'oklch(55% 0.22 25)' };
  return { background: 'oklch(52% 0.012 260 / 0.12)', color: 'oklch(52% 0.012 260)' };
}
const ROLE_LABEL: Record<AccountType, string> = {
  'privilégié': 'Admin', 'nominatif': 'Opérateur', 'service': 'Service', 'partagé': 'Lecteur',
};
const PAGE_SIZE = 10;

// ─── KPI Card ───

function KpiCard({ label, value, delta, deltaUp, kpiColor, icon }: {
  label: string; value: string; delta: string; deltaUp?: boolean; kpiColor: string; icon: React.ReactNode;
}) {
  return (
    <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpiColor, borderRadius: '10px 10px 0 0' }} />
      <div style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 8, background: kpiColor, opacity: 0.12 }} />
      <div style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', color: 'oklch(18% 0.02 260)' }}>{value}</div>
      <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: deltaUp === true ? 'oklch(62% 0.16 155)' : deltaUp === false ? 'oklch(55% 0.22 25)' : 'oklch(52% 0.012 260)' }}>{delta}</div>
    </div>
  );
}

// ─── Liste ───

function MembresList({ members, accessRights = [], onNew }: { members: Member[]; accessRights?: AccessRight[]; onNew: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const hasMfaIssue = (m: Member) => m.risk_factors.some(f => f.label.toLowerCase().includes('mfa'));

  const riskLabel = (s: number) => s >= 75 ? 'Critique' : s >= 50 ? 'Élevé' : s >= 25 ? 'Moyen' : 'Faible';

  const filtered = members.filter((m) => {
    if (search && !m.full_name.toLowerCase().includes(search.toLowerCase())
      && !m.email.toLowerCase().includes(search.toLowerCase())
      && !m.team.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && ROLE_LABEL[m.account_type] !== roleFilter) return false;
    if (riskFilter && riskLabel(m.risk_score) !== riskFilter) return false;
    if (statusFilter) {
      const sl = statusFilter.toLowerCase();
      if (sl === 'actif' && m.status !== 'actif') return false;
      if (sl === 'inactif' && m.status !== 'inactif') return false;
      if (sl === 'suspendu' && m.status !== 'suspendu') return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount = members.filter(m => m.status === 'actif').length;
  const noMfaCount = members.filter(hasMfaIssue).length;
  const expiredCount = members.filter(m => m.departure_date && new Date(m.departure_date) <= new Date()).length;

  const allSelected = pageItems.length > 0 && pageItems.every(m => selected.has(m.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) pageItems.forEach(m => next.delete(m.id));
    else pageItems.forEach(m => next.add(m.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const exportCsv = () => {
    const ws = XLSX.utils.json_to_sheet(members.map((m) => ({
      Nom: m.full_name, Email: m.email, Département: m.team,
      Rôle: ROLE_LABEL[m.account_type], Statut: m.status, 'Score risque': m.risk_score,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membres');
    XLSX.writeFile(wb, 'membres.csv');
  };

  const iconBtnStyle: React.CSSProperties = {
    display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6,
    border: '1px solid oklch(90% 0.006 260)', background: 'transparent', cursor: 'pointer',
    color: 'oklch(52% 0.012 260)', transition: 'all 0.12s',
  };

  const pageRange = () => {
    const pages: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Topbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Membres</div>
          <div style={{ fontSize: 12, color: 'oklch(52% 0.012 260)' }}>Gestion des utilisateurs et des accès</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)' }}>
          <Download className="w-3.5 h-3.5" /> Exporter CSV
        </button>
        <button onClick={onNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none' }}>
          <Plus className="w-3.5 h-3.5" /> Ajouter un membre
        </button>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <KpiCard label="Membres totaux" value={String(members.length)} delta={`↑ +${Math.max(0, members.length - activeCount)} ce mois-ci`} deltaUp={true} kpiColor="oklch(42% 0.18 280)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(42% 0.18 280)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <KpiCard label="Comptes actifs" value={String(activeCount)} delta={`→ ${members.length > 0 ? Math.round(activeCount / members.length * 1000) / 10 : 0}% du total`} kpiColor="oklch(62% 0.16 155)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(62% 0.16 155)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <KpiCard label="Sans MFA actif" value={String(noMfaCount)} delta={`↑ +${noMfaCount} détectés`} deltaUp={false} kpiColor="oklch(62% 0.18 52)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(62% 0.18 52)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
        />
        <KpiCard label="Comptes expirés" value={String(expiredCount)} delta="Nécessitent une action" deltaUp={false} kpiColor="oklch(55% 0.22 25)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(55% 0.22 25)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
      </div>

      {/* Main card */}
      <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Liste des membres</span>
          <span style={{ fontSize: 11, color: 'oklch(52% 0.012 260)' }}>— {filtered.length} entrées</span>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'oklch(52% 0.012 260)', fontFamily: 'JetBrains Mono, monospace' }}>{PAGE_SIZE} affichés / page</div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'oklch(52% 0.012 260)', pointerEvents: 'none' }} />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher par nom, email, département…"
              style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid oklch(90% 0.006 260)', borderRadius: 7, fontSize: 12.5, background: 'oklch(97% 0.005 260)', color: 'oklch(18% 0.02 260)', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: 7, fontSize: 12.5, background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Tous les rôles</option>
            <option>Admin</option><option>Opérateur</option><option>Service</option><option>Lecteur</option>
          </select>
          <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: 7, fontSize: 12.5, background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Tous les risques</option>
            <option>Critique</option><option>Élevé</option><option>Moyen</option><option>Faible</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: 7, fontSize: 12.5, background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Tous les statuts</option>
            <option>Actif</option><option>Inactif</option><option>Suspendu</option>
          </select>
          <div style={{ flex: 1 }} />
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filtres avancés
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Membre ↕', 'Département ↕', 'Rôle ↕', 'Dernière connexion ↕', 'Score risque ↕', 'Habilitations', 'MFA', 'Statut ↕', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap', cursor: h.includes('↕') ? 'pointer' : 'default' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => {
                const habCount = accessRights.filter(a => a.member_id === m.id && a.level !== 'none').length;
                const mfaOk = !hasMfaIssue(m);
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', transition: 'background 0.1s', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle' }} onClick={e => { e.stopPropagation(); toggleOne(m.id); }}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle' }} onClick={() => navigate(`/membres/${m.id}`)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'oklch(42% 0.12 280 / 0.12)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'oklch(42% 0.18 280)', flexShrink: 0 }}>
                          {m.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{m.full_name}</div>
                          <div style={{ fontSize: 11, color: 'oklch(52% 0.012 260)', fontFamily: 'JetBrains Mono, monospace' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle', fontSize: 12.5 }} onClick={() => navigate(`/membres/${m.id}`)}>{m.team}</td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle', fontSize: 12.5 }} onClick={() => navigate(`/membres/${m.id}`)}>{ROLE_LABEL[m.account_type]}</td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'oklch(52% 0.012 260)' }} onClick={() => navigate(`/membres/${m.id}`)}>
                      {m.updated_at ? new Date(m.updated_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle' }} onClick={() => navigate(`/membres/${m.id}`)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 20, borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', background: scoreBg(m.risk_score), color: scoreColor(m.risk_score) }}>{m.risk_score}</span>
                    </td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'oklch(52% 0.012 260)' }} onClick={() => navigate(`/membres/${m.id}`)}>{habCount}</td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle' }} onClick={() => navigate(`/membres/${m.id}`)}>
                      {mfaOk
                        ? <span style={{ color: 'oklch(62% 0.16 155)', fontSize: 12, fontWeight: 600 }}>✓ Actif</span>
                        : <span style={{ color: 'oklch(62% 0.18 52)', fontSize: 12, fontWeight: 600 }}>✗ Inactif</span>
                      }
                    </td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle' }} onClick={() => navigate(`/membres/${m.id}`)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, ...statusStyle(m.status) }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={iconBtnStyle} title="Voir le profil" onClick={() => navigate(`/membres/${m.id}`)}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(42% 0.12 280 / 0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(42% 0.18 280)'; (e.currentTarget as HTMLElement).style.color = 'oklch(42% 0.18 280)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(90% 0.006 260)'; (e.currentTarget as HTMLElement).style.color = 'oklch(52% 0.012 260)'; }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button style={iconBtnStyle} title="Gérer les habilitations" onClick={() => navigate('/habilitations')}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(42% 0.12 280 / 0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(42% 0.18 280)'; (e.currentTarget as HTMLElement).style.color = 'oklch(42% 0.18 280)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(90% 0.006 260)'; (e.currentTarget as HTMLElement).style.color = 'oklch(52% 0.012 260)'; }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        </button>
                        <button style={iconBtnStyle} title="Plus d'options"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(42% 0.12 280 / 0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(42% 0.18 280)'; (e.currentTarget as HTMLElement).style.color = 'oklch(42% 0.18 280)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(90% 0.006 260)'; (e.currentTarget as HTMLElement).style.color = 'oklch(52% 0.012 260)'; }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={10}>
                  <EmptyState icon={Users} title="Aucun membre" description="Ajoutez votre premier membre ou importez une liste via le module Import." action={{ label: '+ Ajouter un membre', onClick: onNew }} hint="Conseil : utilisez l'Import IA pour charger un fichier Excel en quelques secondes." />
                </td></tr>
              )}
              {members.length > 0 && filtered.length === 0 && (
                <tr><td colSpan={10}>
                  <FilterEmpty onReset={() => { setSearch(''); setRoleFilter(''); setRiskFilter(''); setStatusFilter(''); setPage(1); }} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 20px', borderTop: '1px solid oklch(90% 0.006 260)' }}>
            <span style={{ fontSize: 12, color: 'oklch(52% 0.012 260)', fontFamily: 'JetBrains Mono, monospace' }}>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </span>
            <div style={{ flex: 1 }} />
            <button disabled={safePage === 1} onClick={() => setPage(p => p - 1)}
              style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid oklch(90% 0.006 260)', background: 'transparent', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 12.5, color: 'oklch(18% 0.02 260)', opacity: safePage === 1 ? 0.4 : 1 }}>‹</button>
            {pageRange().map(p => (
              <button key={p} onClick={() => setPage(p)}
                style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid oklch(90% 0.006 260)', background: p === safePage ? 'oklch(42% 0.18 280)' : 'transparent', cursor: 'pointer', fontSize: 12.5, color: p === safePage ? '#fff' : 'oklch(18% 0.02 260)', borderColor: p === safePage ? 'oklch(42% 0.18 280)' : 'oklch(90% 0.006 260)' }}>{p}</button>
            ))}
            <button disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}
              style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid oklch(90% 0.006 260)', background: 'transparent', cursor: safePage === totalPages ? 'default' : 'pointer', fontSize: 12.5, color: 'oklch(18% 0.02 260)', opacity: safePage === totalPages ? 0.4 : 1 }}>›</button>
          </div>
        )}
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
  const [offboarding, setOffboarding] = useState(false);
  const member = members.find((m) => m.id === memberId);
  if (!member) return <div className="p-8 text-gray-400">Membre non trouvé</div>;

  const isDepartureReached = member.status === 'actif' && member.departure_date && new Date(member.departure_date) <= new Date();

  const handleOffboard = async () => {
    if (!confirm(`Confirmer l'offboarding de ${member.full_name} ?\n\nTous ses accès seront révoqués et son statut passera à "inactif".`)) return;
    setOffboarding(true);
    try {
      const result = await api.members.offboard(member.id);
      toast.success(`Offboarding effectué — ${result.revokedCount} accès révoqué(s)`);
      navigate('/membres');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOffboarding(false);
    }
  };

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
            {isDepartureReached && (
              <button
                onClick={handleOffboard}
                disabled={offboarding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {offboarding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                Offboarding
              </button>
            )}
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
