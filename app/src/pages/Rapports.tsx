// ═══════════════════════════════════════════
// Page Rapports
// ═══════════════════════════════════════════

import React, { useState } from 'react';
import { FileText, Shield, TrendingUp, Award, FileSpreadsheet, UserX, Download, Loader2, ClipboardCheck, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Member, Platform, AccessRight, Subscription, System, Alert } from '@/types';
import { ACCESS_LEVEL_CONFIG } from '@/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getPlanLimits, UPGRADE_MSG } from '@/lib/planLimits';
import { PlanGate } from '@/components/PlanGate';

interface RapportsProps {
  members: Member[];
  platforms: Platform[];
  accessRights: AccessRight[];
  subscriptions: Subscription[];
  systems?: System[];
  alerts?: Alert[];
  plan?: string;
}

export function Rapports({ members, platforms, accessRights, subscriptions, systems = [], alerts = [], plan }: RapportsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const canExport = getPlanLimits(plan).exportEnabled;

  const now = new Date();
  const adminCount = accessRights.filter(a => a.level === 'admin').length;
  const overdueCount = accessRights.filter(a => a.next_review_date && new Date(a.next_review_date) < now && a.level !== 'none').length;
  const noMfaCount = platforms.filter(p => !p.has_mfa).length;
  const criticalAlerts = alerts.filter(a => !a.is_resolved && a.severity === 'critical').length;
  const activeMembers = members.filter(m => m.status === 'actif').length;
  const avgRisk = members.length ? Math.round(members.reduce((s, m) => s + m.risk_score, 0) / members.length) : 0;
  const expiringSubs = subscriptions.filter(s => { if (!s.renewal_date || s.status !== 'actif') return false; return Math.floor((new Date(s.renewal_date).getTime() - now.getTime()) / 86400000) <= 30; }).length;
  const eolSystems = systems.filter(s => { if (!s.end_of_support_date) return false; return Math.floor((new Date(s.end_of_support_date).getTime() - now.getTime()) / 86400000) <= 90; }).length;
  let score = 100;
  if (noMfaCount > 0) score -= Math.min(20, noMfaCount * 5);
  if (overdueCount > 0) score -= Math.min(20, overdueCount * 2);
  if (criticalAlerts > 0) score -= Math.min(20, criticalAlerts * 5);
  if (eolSystems > 0) score -= Math.min(10, eolSystems * 3);
  if (expiringSubs > 0) score -= Math.min(10, expiringSubs * 2);
  score = Math.max(0, score);

  const indicators = { activeMembers, totalMembers: members.length, avgRisk, adminCount, overdueCount, noMfaCount, criticalAlerts, expiringSubs, eolSystems };

  const generate = async (id: string) => {
    setLoading(id);
    try {
      switch (id) {
        case 'compliance': {
          toast.info('Rédaction IA en cours…', { duration: 8000 });
          let aiSections = null;
          try {
            aiSections = await api.reports.generate({
              orgName: 'Mon organisation',
              reportDate: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
              members, platforms, accessRights, subscriptions, systems, alerts,
              score, indicators,
            });
          } catch {
            toast.error("L'IA n'a pas pu rédiger le rapport, génération sans textes analytiques.");
          }
          generateCompliance(members, platforms, accessRights, subscriptions, systems, alerts, score, indicators, aiSections);
          break;
        }
        case 'hab': generateHabilitations(members, platforms, accessRights); break;
        case 'review': generateRevue(accessRights, members, platforms); break;
        case 'risk': generateRisk(members, platforms); break;
        case 'iso': generateISO(members, platforms, accessRights); break;
        case 'subs': generateSubscriptions(subscriptions); break;
        case 'offboard': generateOffboard(members, platforms, accessRights); break;
      }
      toast.success('Rapport téléchargé');
    } catch {
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setLoading(null);
    }
  };

  const REPORTS = [
    {
      id: 'compliance',
      title: 'Rapport de conformité complet',
      desc: 'Résumé exécutif, score global, habilitations, risques, abonnements, systèmes — prêt pour un audit',
      icon: ClipboardCheck,
      color: '#534AB7',
      format: 'PDF',
      featured: true,
    },
    {
      id: 'hab',
      title: 'Rapport Habilitations',
      desc: 'Matrice complète membres × plateformes, liste des Admin par plateforme, accès non revus',
      icon: Shield,
      color: '#534AB7',
      format: 'PDF',
    },
    {
      id: 'review',
      title: "Rapport Revue d'accès",
      desc: 'Accès en retard de revue avec horodatage, responsable et niveau actuel',
      icon: FileText,
      color: '#3B82F6',
      format: 'PDF',
    },
    {
      id: 'risk',
      title: 'Rapport Score de risque',
      desc: 'Top 10 membres à risque + plateformes sans MFA, avec détail des facteurs',
      icon: TrendingUp,
      color: '#E24B4A',
      format: 'PDF',
    },
    {
      id: 'iso',
      title: 'Rapport ISO 27001 — A.9',
      desc: 'Contrôle des accès : politique, matrice, revues, preuves de révocations',
      icon: Award,
      color: '#1D9E75',
      format: 'PDF',
    },
    {
      id: 'subs',
      title: 'Export registre abonnements',
      desc: 'Tous les abonnements avec coûts mensuels, annuels et dates de renouvellement',
      icon: FileSpreadsheet,
      color: '#EF9F27',
      format: 'XLSX',
    },
    {
      id: 'offboard',
      title: 'Rapport Offboarding',
      desc: 'Checklist de révocations pour les membres avec date de départ planifiée',
      icon: UserX,
      color: '#6B7280',
      format: 'PDF',
    },
  ];

  // No report history API exists — empty state
  const RECENT_REPORTS: never[] = [];
  const SCHEDULE: never[] = [];

  const statusPillStyle = (s: string): React.CSSProperties => {
    if (s === 'ready')   return { background: 'oklch(62% 0.16 155 / 0.1)', color: 'oklch(62% 0.16 155)' };
    if (s === 'running') return { background: 'oklch(42% 0.18 280 / 0.12)', color: 'oklch(42% 0.18 280)' };
    return { background: 'oklch(55% 0.22 25 / 0.1)', color: 'oklch(55% 0.22 25)' };
  };
  const statusLabel = (s: string) => s === 'ready' ? 'Prêt' : s === 'running' ? 'En cours' : 'Échoué';

  const TPL_COLORS: Record<string, { bg: string; color: string }> = {
    blue:   { bg: 'oklch(42% 0.18 280 / 0.12)', color: 'oklch(42% 0.18 280)' },
    green:  { bg: 'oklch(62% 0.16 155 / 0.12)', color: 'oklch(62% 0.16 155)' },
    amber:  { bg: 'oklch(70% 0.14 88 / 0.12)',  color: 'oklch(70% 0.14 88)'  },
    orange: { bg: 'oklch(62% 0.18 52 / 0.12)',  color: 'oklch(62% 0.18 52)'  },
    red:    { bg: 'oklch(55% 0.22 25 / 0.12)',  color: 'oklch(55% 0.22 25)'  },
  };

  const TEMPLATES = [
    { id: 'compliance', name: 'Rapport SOC 2 Type II',            standard: 'SOC 2',  color: 'blue',   desc: 'Conformité des contrôles de sécurité et disponibilité',                    date: '01/05/2026', iconPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8' },
    { id: 'iso',        name: 'ISO 27001',                        standard: 'ISO',    color: 'green',  desc: "Audit annuel du système de management de la sécurité",                      date: '15/03/2026', iconPath: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
    { id: 'risk',       name: 'NIS2',                             standard: 'NIS2',   color: 'amber',  desc: 'Directive européenne sur la cybersécurité des entités essentielles',         date: null,         iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
    { id: 'review',     name: 'Revue des accès trimestrielle',    standard: 'Accès',  color: 'blue',   desc: 'Certification des habilitations et droits actifs par département',           date: '01/04/2026', iconPath: 'M3 11h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V11z M7 11V7a5 5 0 0110 0v4' },
    { id: 'hab',        name: "Rapport d'anomalies mensuel",      standard: 'Sécurité',color: 'orange', desc: 'Synthèse des alertes, incidents et comportements anormaux',                  date: '01/05/2026', iconPath: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01' },
    { id: 'offboard',   name: 'Inventaire des droits',           standard: 'Accès',  color: 'green',  desc: 'Liste exhaustive des droits et permissions par utilisateur',                date: '24/05/2026', iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  ];

  const nextExpiringSub = subscriptions
    .filter(s => s.status === 'actif' && s.renewal_date && new Date(s.renewal_date) > now)
    .sort((a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime())[0];
  const nextSubDays = nextExpiringSub
    ? Math.floor((new Date(nextExpiringSub.renewal_date).getTime() - now.getTime()) / 86400000)
    : null;

  const KPI_CELLS = [
    {
      label: "Revues d'accès en retard",
      value: String(overdueCount),
      color: overdueCount > 0 ? 'oklch(62% 0.18 52)' : 'oklch(62% 0.16 155)',
      sub: overdueCount > 0 ? 'Action requise' : 'À jour',
      ok: overdueCount === 0,
    },
    {
      label: 'Plateformes sans MFA',
      value: String(noMfaCount),
      color: noMfaCount > 0 ? 'oklch(55% 0.22 25)' : 'oklch(62% 0.16 155)',
      sub: noMfaCount > 0 ? 'Risque' : 'Toutes protégées',
      ok: noMfaCount === 0,
    },
    {
      label: 'Alertes critiques actives',
      value: String(criticalAlerts),
      color: criticalAlerts > 0 ? 'oklch(55% 0.22 25)' : 'oklch(62% 0.16 155)',
      sub: criticalAlerts > 0 ? 'Action requise' : 'Aucune',
      ok: criticalAlerts === 0,
    },
    {
      label: 'Abonnements expirant sous 30j',
      value: String(expiringSubs),
      color: expiringSubs > 0 ? 'oklch(62% 0.18 52)' : 'oklch(62% 0.16 155)',
      sub: expiringSubs > 0 ? 'À renouveler' : 'OK',
      ok: expiringSubs === 0,
    },
    {
      label: 'Systèmes fin de support (<90j)',
      value: String(eolSystems),
      color: eolSystems > 0 ? 'oklch(62% 0.18 52)' : 'oklch(62% 0.16 155)',
      sub: eolSystems > 0 ? 'À migrer' : 'OK',
      ok: eolSystems === 0,
    },
    {
      label: 'Score de conformité',
      value: `${score}%`,
      color: score >= 80 ? 'oklch(62% 0.16 155)' : score >= 50 ? 'oklch(62% 0.18 52)' : 'oklch(55% 0.22 25)',
      sub: score >= 80 ? 'Bonne conformité' : score >= 50 ? 'À améliorer' : 'Action requise',
      ok: score >= 80,
    },
  ];

  const BORDER  = 'oklch(90% 0.006 260)';
  const SURFACE = 'oklch(100% 0 0)';
  const FG      = 'oklch(18% 0.02 260)';
  const MUTED   = 'oklch(52% 0.012 260)';
  const BRAND   = 'oklch(42% 0.18 280)';

  const card: React.CSSProperties = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, display: 'flex', flexDirection: 'column' };
  const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, gap: 10 };
  const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, padding: '10px 20px', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 20px', verticalAlign: 'middle' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Topbar row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: FG }}>Rapports</div>
          <div style={{ fontSize: 12, color: MUTED }}>Conformité et analyse</div>
        </div>
        <PlanGate locked={!canExport} message={UPGRADE_MSG}>
          <button
            onClick={() => generate('compliance')}
            disabled={loading === 'compliance'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: BRAND, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', opacity: loading === 'compliance' ? 0.6 : 1 }}
          >
            {loading === 'compliance' ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )}
            {loading === 'compliance' ? 'Rédaction IA…' : 'Générer un rapport'}
          </button>
        </PlanGate>
      </div>

      {/* Two-col 1fr 2fr */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Left: template list */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Modèles de rapports</span>
            <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>— {TEMPLATES.length} modèles</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TEMPLATES.map((t, i) => {
              const col = TPL_COLORS[t.color];
              return (
                <div key={t.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: i < TEMPLATES.length - 1 ? `1px solid ${BORDER}` : 'none', transition: 'background 0.1s', cursor: 'default' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: col.bg, color: col.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                      {t.iconPath.split(' M').map((seg, j) => <path key={j} d={j === 0 ? seg : 'M' + seg} />)}
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: FG }}>{t.name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, background: 'oklch(42% 0.18 280 / 0.12)', color: BRAND, padding: '1px 6px', borderRadius: 4 }}>{t.standard}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{t.desc}</div>
                    <div style={{ fontSize: 10.5, color: t.date ? MUTED : 'oklch(62% 0.18 52)', marginTop: 4, fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>
                      {t.date ? `Généré le ${t.date}` : 'Jamais généré'}
                    </div>
                  </div>
                  <PlanGate locked={!canExport} message={UPGRADE_MSG}>
                    <button
                      onClick={() => generate(t.id)}
                      disabled={loading === t.id}
                      style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, transition: 'all 0.12s', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(42% 0.18 280 / 0.12)'; e.currentTarget.style.color = BRAND; e.currentTarget.style.borderColor = BRAND; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER; }}
                    >
                      {loading === t.id ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : null}
                      Générer
                    </button>
                  </PlanGate>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Recent reports table */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Rapports récents</span>
              <div style={{ marginLeft: 'auto' }}>
                <button style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED }}>Tout afficher</button>
              </div>
            </div>
            {RECENT_REPORTS.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Nom','Période','Généré par','Date','Taille','Statut','Actions'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_REPORTS.map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 36, height: 36, margin: '0 auto 10px', opacity: 0.35, display: 'block' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Aucun rapport généré — utilisez les modèles ci-contre pour en créer un.
              </div>
            )}
          </div>

          {/* Scheduling */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Planification</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>— {SCHEDULE.length} rapport{SCHEDULE.length !== 1 ? 's' : ''} programmé{SCHEDULE.length !== 1 ? 's' : ''}</span>
              <div style={{ marginLeft: 'auto' }}>
                <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Planifier
                </button>
              </div>
            </div>
            {SCHEDULE.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 36, height: 36, margin: '0 auto 10px', opacity: 0.35, display: 'block' }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Aucun rapport planifié — cliquez sur « Planifier » pour en configurer un.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }} />
            )}
          </div>

          {/* KPI grid 3×2 */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Indicateurs clés</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {KPI_CELLS.map((k, i) => (
                <div key={i} style={{ padding: '18px 20px', borderRight: i % 3 !== 2 ? `1px solid ${BORDER}` : 'none', borderBottom: i < 3 ? `1px solid ${BORDER}` : 'none' }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono',ui-monospace,monospace", letterSpacing: '-0.02em', color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Helpers PDF ───

function addPageHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Bande violette en haut
  doc.setFillColor(83, 74, 183);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 12);
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, doc.internal.pageSize.width - 14, 12, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

function addSectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(83, 74, 183);
  doc.text(text, 14, y);
  doc.setDrawColor(83, 74, 183);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, 196, y + 1.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

function getY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
}

// ─── Rapport Conformité Complet ───

type AISections = {
  executiveSummary: string;
  accessControl: string;
  riskAnalysis: string;
  subscriptionGovernance: string;
  systemCompliance: string;
  alertsSummary: string;
  recommendations: string;
  conclusion: string;
} | null;

type Indicators = {
  activeMembers: number; totalMembers: number; avgRisk: number; adminCount: number;
  overdueCount: number; noMfaCount: number; criticalAlerts: number; expiringSubs: number; eolSystems: number;
};

function decodeHtmlEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function addAIText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const clean = decodeHtmlEntities(text);
  const lines = doc.splitTextToSize(clean, maxWidth);
  doc.text(lines, x, y);
  doc.setTextColor(0, 0, 0);
  return y + lines.length * 4.5;
}

function generateCompliance(
  members: Member[],
  platforms: Platform[],
  accessRights: AccessRight[],
  subscriptions: Subscription[],
  systems: System[],
  alerts: Alert[],
  score: number,
  indicators: Indicators,
  ai: AISections,
) {
  const doc = new jsPDF();
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const { activeMembers, avgRisk, adminCount, overdueCount, noMfaCount, criticalAlerts, expiringSubs, eolSystems } = indicators;

  // ── Page de garde ──
  doc.setFillColor(83, 74, 183);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Rapport de', 20, 80);
  doc.text('Conformité', 20, 95);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Gouvernance IT & Gestion des accès', 20, 112);

  if (ai) {
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255, 0.8);
    doc.text('✦ Rédigé par intelligence artificielle', 20, 122);
    doc.setTextColor(255, 255, 255);
  }

  doc.setFillColor(255, 255, 255, 0.15);
  doc.roundedRect(20, 135, 170, 55, 4, 4, 'F');

  const stats = [
    ['Membres', String(members.length)],
    ['Plateformes', String(platforms.length)],
    ['Droits actifs', String(accessRights.filter(a => a.level !== 'none').length)],
    ['Abonnements', String(subscriptions.length)],
    ['Systèmes', String(systems.length)],
    ['Alertes actives', String(alerts.filter(a => !a.is_resolved).length)],
  ];
  stats.forEach(([label, val], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 28 + col * 57;
    const y = 148 + row * 22;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(val, x, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255, 0.65);
    doc.text(label, x, y + 6);
  });

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255, 0.5);
  doc.text(`Généré le ${dateStr} · Tracix`, 20, 270);

  // ── Page 2 — Résumé exécutif ──
  doc.addPage();
  addPageHeader(doc, 'Résumé exécutif', dateStr);

  const scoreColor: [number, number, number] = score >= 80 ? [29, 158, 117] : score >= 50 ? [239, 159, 39] : [226, 75, 74];

  doc.setFillColor(...scoreColor);
  doc.circle(170, 38, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(String(score), 170, 35, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('/100', 170, 42, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Score de conformité global', 14, 30);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Calculé sur la base des alertes critiques, revues en retard, MFA et fins de support.', 14, 37);
  doc.setTextColor(0);

  // Synthèse IA
  if (ai?.executiveSummary) {
    addSectionTitle(doc, 'Synthèse', 50);
    addAIText(doc, ai.executiveSummary, 14, 55, 182);
  }

  const kpiStartY = ai?.executiveSummary ? Math.min(getY(doc) + 8, 130) : 55;
  addSectionTitle(doc, 'Indicateurs clés', kpiStartY);
  autoTable(doc, {
    head: [['Indicateur', 'Valeur', 'Statut']],
    body: [
      ['Membres actifs', `${activeMembers} / ${members.length}`, ''],
      ['Score de risque moyen', String(avgRisk), avgRisk <= 39 ? '⚠ Critique' : avgRisk <= 69 ? '~ À surveiller' : '✓ Conforme'],
      ['Droits Admin actifs', String(adminCount), adminCount > 10 ? '⚠ Élevé' : '✓ OK'],
      ["Revues d'accès en retard", String(overdueCount), overdueCount > 0 ? '⚠ Action requise' : '✓ À jour'],
      ['Plateformes sans MFA', String(noMfaCount), noMfaCount > 0 ? '⚠ Risque' : '✓ Toutes protégées'],
      ['Alertes critiques actives', String(criticalAlerts), criticalAlerts > 0 ? '⚠ Action requise' : '✓ Aucune'],
      ['Abonnements expirant sous 30j', String(expiringSubs), expiringSubs > 0 ? '⚠ À renouveler' : '✓ OK'],
      ['Systèmes fin de support (<90j)', String(eolSystems), eolSystems > 0 ? '⚠ À migrer' : '✓ OK'],
    ],
    startY: kpiStartY + 3,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [83, 74, 183] },
  });

  // ── Page 3 — Habilitations ──
  doc.addPage();
  addPageHeader(doc, "Habilitations — Matrice d'accès", dateStr);

  let p3y = 24;
  if (ai?.accessControl) {
    addSectionTitle(doc, 'Analyse de la gestion des accès', p3y);
    p3y = addAIText(doc, ai.accessControl, 14, p3y + 5, 182) + 6;
  }
  addSectionTitle(doc, 'Comptes Admin par plateforme', p3y);
  const adminByPlatform = platforms.map(p => ({
    platform: p,
    admins: accessRights.filter(a => a.platform_id === p.id && a.level === 'admin'),
  })).filter(x => x.admins.length > 0);

  autoTable(doc, {
    head: [['Plateforme', 'Env.', 'MFA', 'Admin', 'Administrateurs']],
    body: adminByPlatform.map(({ platform: p, admins }) => [
      p.name,
      p.environment,
      p.has_mfa ? '✓ Oui' : '✗ Non',
      String(admins.length),
      admins.map(a => members.find(m => m.id === a.member_id)?.full_name ?? '?').join(', '),
    ]),
    startY: p3y + 3,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [83, 74, 183] },
    columnStyles: { 2: { fontStyle: 'bold' } },
  });

  const y3b = getY(doc) + 8;
  addSectionTitle(doc, 'Revues d\'accès en retard', y3b);
  const overdue = accessRights.filter(a => a.next_review_date && new Date(a.next_review_date) < now && a.level !== 'none');
  if (overdue.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(29, 158, 117);
    doc.text('✓ Aucune revue en retard', 14, y3b + 8);
    doc.setTextColor(0);
  } else {
    autoTable(doc, {
      head: [['Membre', 'Équipe', 'Plateforme', 'Niveau', 'Dernière revue', 'Retard (j)']],
      body: overdue.slice(0, 20).map(a => {
        const m = members.find(x => x.id === a.member_id);
        const p = platforms.find(x => x.id === a.platform_id);
        const days = Math.floor((now.getTime() - new Date(a.next_review_date).getTime()) / 86400000);
        return [m?.full_name ?? '?', m?.team ?? '?', p?.name ?? '?', ACCESS_LEVEL_CONFIG[a.level].label, a.last_review_date ? new Date(a.last_review_date).toLocaleDateString('fr-FR') : '—', String(days)];
      }),
      startY: y3b + 3,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // ── Page 4 — Risques & Alertes ──
  doc.addPage();
  addPageHeader(doc, 'Risques & Alertes', dateStr);

  let p4y = 24;
  if (ai?.riskAnalysis) {
    addSectionTitle(doc, 'Analyse des risques', p4y);
    p4y = addAIText(doc, ai.riskAnalysis, 14, p4y + 5, 182) + 6;
  }
  if (ai?.alertsSummary) {
    addSectionTitle(doc, 'Synthèse des alertes', p4y);
    p4y = addAIText(doc, ai.alertsSummary, 14, p4y + 5, 182) + 6;
  }
  addSectionTitle(doc, 'Top 10 membres à risque', p4y);
  const top10 = [...members].sort((a, b) => a.risk_score - b.risk_score).slice(0, 10);
  autoTable(doc, {
    head: [['Membre', 'Équipe', 'Type', 'Score', 'Facteurs']],
    body: top10.map(m => [
      m.full_name,
      m.team,
      m.account_type,
      String(m.risk_score),
      m.risk_factors.slice(0, 3).map(f => f.label).join(', ') || '—',
    ]),
    startY: p4y + 3,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [226, 75, 74] },
  });

  const y4b = getY(doc) + 8;
  addSectionTitle(doc, 'Alertes actives', y4b);
  const activeAlerts = alerts.filter(a => !a.is_resolved);
  if (activeAlerts.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(29, 158, 117);
    doc.text('✓ Aucune alerte active', 14, y4b + 8);
    doc.setTextColor(0);
  } else {
    autoTable(doc, {
      head: [['Sévérité', 'Module', 'Objet', 'Message', 'Créée le']],
      body: activeAlerts.slice(0, 15).map(a => [
        a.severity,
        a.source_module,
        a.source_label,
        a.message.substring(0, 60) + (a.message.length > 60 ? '…' : ''),
        new Date(a.created_at).toLocaleDateString('fr-FR'),
      ]),
      startY: y4b + 3,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [226, 75, 74] },
    });
  }

  // ── Page 5 — Abonnements & Systèmes ──
  doc.addPage();
  addPageHeader(doc, 'Abonnements & Systèmes', dateStr);

  let p5y = 24;
  if (ai?.subscriptionGovernance) {
    addSectionTitle(doc, 'Gouvernance des abonnements', p5y);
    p5y = addAIText(doc, ai.subscriptionGovernance, 14, p5y + 5, 182) + 6;
  }
  if (ai?.systemCompliance) {
    addSectionTitle(doc, 'Conformité des systèmes', p5y);
    p5y = addAIText(doc, ai.systemCompliance, 14, p5y + 5, 182) + 6;
  }
  addSectionTitle(doc, 'Abonnements à renouveler sous 60 jours', p5y);
  const upcoming = subscriptions.filter(s => {
    if (!s.renewal_date || s.status !== 'actif') return false;
    const days = Math.floor((new Date(s.renewal_date).getTime() - now.getTime()) / 86400000);
    return days >= 0 && days <= 60;
  }).sort((a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime());

  if (upcoming.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(29, 158, 117);
    doc.text('✓ Aucun abonnement à renouveler dans les 60 prochains jours', 14, p5y + 8);
    doc.setTextColor(0);
  } else {
    autoTable(doc, {
      head: [['Abonnement', 'Fournisseur', 'Coût annuel', 'Renouvellement', 'Jours', 'Responsable']],
      body: upcoming.map(s => {
        const days = Math.floor((new Date(s.renewal_date).getTime() - now.getTime()) / 86400000);
        return [s.name, s.vendor, `${s.cost_annual.toLocaleString('fr-FR')} ${s.currency}`, new Date(s.renewal_date).toLocaleDateString('fr-FR'), String(days), s.responsible];
      }),
      startY: p5y + 3,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 159, 39] },
    });
  }

  if (systems.length > 0) {
    const y5b = Math.max(getY(doc) + 8, 70);
    addSectionTitle(doc, 'Systèmes — fin de support à venir', y5b);
    const eolList = systems.filter(s => {
      if (!s.end_of_support_date) return false;
      return Math.floor((new Date(s.end_of_support_date).getTime() - now.getTime()) / 86400000) <= 180;
    }).sort((a, b) => new Date(a.end_of_support_date).getTime() - new Date(b.end_of_support_date).getTime());

    if (eolList.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(29, 158, 117);
      doc.text('✓ Aucun système en fin de support dans les 6 prochains mois', 14, y5b + 8);
      doc.setTextColor(0);
    } else {
      autoTable(doc, {
        head: [['Hostname', 'OS', 'Criticité', 'Fin support', 'Jours restants', 'Responsable']],
        body: eolList.map(s => {
          const days = Math.floor((new Date(s.end_of_support_date).getTime() - now.getTime()) / 86400000);
          return [s.hostname, s.os_version, s.criticality, new Date(s.end_of_support_date).toLocaleDateString('fr-FR'), String(days), s.tech_responsible];
        }),
        startY: y5b + 3,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [107, 114, 128] },
      });
    }
  }

  // ── Page 6 — Recommandations & Conclusion (IA uniquement) ──
  if (ai?.recommendations || ai?.conclusion) {
    doc.addPage();
    addPageHeader(doc, 'Recommandations & Conclusion', dateStr);
    let p6y = 24;
    if (ai.recommendations) {
      addSectionTitle(doc, 'Recommandations prioritaires', p6y);
      p6y = addAIText(doc, ai.recommendations, 14, p6y + 5, 182) + 8;
    }
    if (ai.conclusion) {
      addSectionTitle(doc, 'Conclusion', p6y);
      addAIText(doc, ai.conclusion, 14, p6y + 5, 182);
    }
    doc.setFontSize(7);
    doc.setTextColor(180);
    doc.text('Ce rapport a été rédigé avec l\'assistance de l\'intelligence artificielle Tracix sur la base des données de votre organisation.', 105, 285, { align: 'center' });
  }

  // ── Pied de page sur chaque page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`Page ${i} / ${pageCount} · Tracix — Rapport de conformité · ${dateStr}`, 105, 292, { align: 'center' });
    }
  }

  doc.save(`rapport-conformite-${now.toISOString().split('T')[0]}.pdf`);
}

// ─── Autres générateurs ───

function generateHabilitations(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const now = new Date().toLocaleDateString('fr-FR');
  addPageHeader(doc, 'Rapport Habilitations', now);

  const headers = ['Membre', 'Équipe', ...platforms.map((p) => p.name.substring(0, 12))];
  const rows = members.map((m) => {
    const cells = platforms.map((p) => {
      const ar = accessRights.find((a) => a.member_id === m.id && a.platform_id === p.id && a.level !== 'none');
      return ar ? ACCESS_LEVEL_CONFIG[ar.level].label : '—';
    });
    return [m.full_name, m.team, ...cells];
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 22,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [83, 74, 183] },
  });

  doc.save('rapport-habilitations.pdf');
}

function generateRevue(accessRights: AccessRight[], members: Member[], platforms: Platform[]) {
  const doc = new jsPDF();
  const now = new Date();
  addPageHeader(doc, "Rapport Revue d'accès", now.toLocaleDateString('fr-FR'));

  const overdue = accessRights.filter((a) => a.next_review_date && new Date(a.next_review_date) < now && a.level !== 'none');
  const rows = overdue.map((a) => {
    const m = members.find((x) => x.id === a.member_id);
    const p = platforms.find((x) => x.id === a.platform_id);
    return [m?.full_name ?? '?', p?.name ?? '?', ACCESS_LEVEL_CONFIG[a.level].label, a.last_review_date ? new Date(a.last_review_date).toLocaleDateString('fr-FR') : '—', a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('fr-FR') : '—'];
  });

  autoTable(doc, {
    head: [['Membre', 'Plateforme', 'Niveau', 'Dernière revue', 'Prochaine revue']],
    body: rows,
    startY: 22,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save('rapport-revue-acces.pdf');
}

function generateRisk(members: Member[], platforms: Platform[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString('fr-FR');
  addPageHeader(doc, 'Rapport Score de risque', now);

  const top10 = [...members].sort((a, b) => a.risk_score - b.risk_score).slice(0, 10);
  autoTable(doc, {
    head: [['Membre', 'Équipe', 'Score', 'Facteurs de risque']],
    body: top10.map((m) => [m.full_name, m.team, String(m.risk_score), m.risk_factors.map((f) => f.label).join(', ') || '—']),
    startY: 22,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [226, 75, 74] },
  });

  const noMfa = platforms.filter((p) => !p.has_mfa).slice(0, 5);
  if (noMfa.length > 0) {
    const y = getY(doc) + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Plateformes sans MFA', 14, y);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      head: [['Plateforme', 'Catégorie', 'Environnement', 'Responsable']],
      body: noMfa.map((p) => [p.name, p.category, p.environment, p.responsible]),
      startY: y + 4,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [226, 75, 74] },
    });
  }

  doc.save('rapport-score-risque.pdf');
}

function generateISO(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF();
  const now = new Date();
  addPageHeader(doc, 'Rapport ISO 27001 — Contrôle des accès (A.9)', now.toLocaleDateString('fr-FR'));

  const adminCount = accessRights.filter((a) => a.level === 'admin').length;
  const overdueCount = accessRights.filter((a) => a.next_review_date && new Date(a.next_review_date) < now && a.level !== 'none').length;
  const noMfaCount = platforms.filter((p) => !p.has_mfa).length;

  autoTable(doc, {
    head: [['Indicateur', 'Valeur', 'Conformité']],
    body: [
      ['Nombre de membres', String(members.length), ''],
      ['Nombre de plateformes', String(platforms.length), ''],
      ['Droits Admin actifs', String(adminCount), adminCount <= 10 ? '✓ Conforme' : '⚠ Élevé'],
      ['Revues en retard', String(overdueCount), overdueCount === 0 ? '✓ À jour' : '⚠ Action requise'],
      ['Plateformes sans MFA', String(noMfaCount), noMfaCount === 0 ? '✓ Toutes protégées' : '⚠ Risque'],
    ],
    startY: 22,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [29, 158, 117] },
  });

  doc.save('rapport-iso27001-a9.pdf');
}

function generateSubscriptions(subscriptions: Subscription[]) {
  const ws = XLSX.utils.json_to_sheet(
    subscriptions.map((s) => ({
      Nom: s.name, Catégorie: s.category, Fournisseur: s.vendor,
      'Coût mensuel': s.cost_monthly, 'Coût annuel': s.cost_annual,
      Devise: s.currency, Cycle: s.billing_cycle,
      'Renouvellement': s.renewal_date ? new Date(s.renewal_date).toLocaleDateString('fr-FR') : '',
      'Auto-renouvellement': s.auto_renew ? 'Oui' : 'Non',
      Responsable: s.responsible, Statut: s.status,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abonnements');
  XLSX.writeFile(wb, 'registre-abonnements.xlsx');
}

function generateOffboard(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString('fr-FR');
  addPageHeader(doc, 'Rapport Offboarding', now);

  const toOffboard = members.filter((m) => m.departure_date);
  if (toOffboard.length === 0) {
    doc.setFontSize(11);
    doc.text('Aucun membre avec date de départ planifiée.', 14, 32);
    doc.save('rapport-offboarding.pdf');
    return;
  }

  toOffboard.forEach((m, idx) => {
    if (idx > 0) doc.addPage();
    const startY = idx === 0 ? 28 : 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${m.full_name} — ${m.team}`, 14, startY);
    doc.setFont('helvetica', 'normal');
    if (m.departure_date) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Départ : ${new Date(m.departure_date).toLocaleDateString('fr-FR')} · Statut : ${m.status}`, 14, startY + 6);
      doc.setTextColor(0);
    }

    const memberAccess = accessRights.filter((a) => a.member_id === m.id && a.level !== 'none');
    autoTable(doc, {
      head: [['Plateforme', 'Niveau', 'Accordé le', 'Action']],
      body: memberAccess.length > 0
        ? memberAccess.map((a) => {
            const p = platforms.find((x) => x.id === a.platform_id);
            return [p?.name ?? '?', ACCESS_LEVEL_CONFIG[a.level].label, a.granted_at ? new Date(a.granted_at).toLocaleDateString('fr-FR') : '—', '☐ À révoquer'];
          })
        : [['Aucun accès actif', '', '', '✓ Terminé']],
      startY: startY + 10,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [107, 114, 128] },
    });
  });

  doc.save('rapport-offboarding.pdf');
}
