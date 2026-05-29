// ═══════════════════════════════════════════
// Page Dashboard — Vue d'ensemble
// ═══════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, SlidersHorizontal, CheckCircle2, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/lib/api';
import { SEVERITY_CONFIG } from '@/types';
import type { Alert, AuditTrail } from '@/types';

interface DashboardProps {
  onResolveAlert: (id: string) => void;
  alerts: Alert[];
  auditTrail: AuditTrail[];
}

// ─── KPI Card ───

function KpiCard({ label, value, delta, deltaUp, kpiColor, icon }: {
  label: string; value: string | number; delta: string; deltaUp?: boolean; kpiColor: string; icon: React.ReactNode;
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

// ─── Risk bar ───

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'oklch(18% 0.02 260)', width: 70, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'oklch(90% 0.006 260)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: color, width: `${pct}%`, transition: 'width 0.6s cubic-bezier(.16,1,.3,1)' }} />
      </div>
      <span style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: 'oklch(52% 0.012 260)', width: 36, textAlign: 'right', flexShrink: 0 }}>{count}</span>
    </div>
  );
}

// ─── Gauge ───

function Gauge({ score }: { score: number }) {
  const arc = 175.93;
  const dash = arc - (score / 100) * arc;
  // risk_score est un score de conformité : bas = dangereux, haut = bon
  const riskLabel = score <= 39 ? 'Risque critique' : score <= 59 ? 'Risque élevé' : score <= 79 ? 'Risque modéré' : 'Risque faible';
  const labelStyle: React.CSSProperties = score <= 39
    ? { background: 'oklch(55% 0.22 25 / 0.12)', color: 'oklch(55% 0.22 25)' }
    : score <= 59
    ? { background: 'oklch(62% 0.18 52 / 0.12)', color: 'oklch(62% 0.18 52)' }
    : score <= 79
    ? { background: 'oklch(70% 0.14 88 / 0.12)', color: 'oklch(70% 0.14 88)' }
    : { background: 'oklch(62% 0.16 155 / 0.12)', color: 'oklch(62% 0.16 155)' };

  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
      <svg width="140" height="84" viewBox="0 0 140 84">
        <path d="M14 77 A56 56 0 0 1 126 77" stroke="oklch(90% 0.006 260)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M14 77 A56 56 0 0 1 126 77" stroke="url(#gGrad)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={arc} strokeDashoffset={dash} />
        <defs>
          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(62% 0.16 155)" />
            <stop offset="60%" stopColor="oklch(70% 0.14 88)" />
            <stop offset="100%" stopColor="oklch(62% 0.18 52)" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'oklch(18% 0.02 260)' }}>{score}</div>
      <div style={{ fontSize: 12, color: 'oklch(52% 0.012 260)' }}>/ 100</div>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 999, ...labelStyle }}>{riskLabel}</span>
    </div>
  );
}

// ─── Pill helpers ───

function SevPill({ sev }: { sev: string }) {
  const [bg, color] = sev === 'critical'
    ? ['oklch(55% 0.22 25 / 0.1)', 'oklch(55% 0.22 25)']
    : sev === 'warning'
    ? ['oklch(62% 0.18 52 / 0.1)', 'oklch(62% 0.18 52)']
    : ['oklch(70% 0.14 88 / 0.1)', 'oklch(70% 0.14 88)'];
  const label = sev === 'critical' ? 'Critique' : sev === 'warning' ? 'Élevé' : 'Moyen';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {label}
    </span>
  );
}

function StatusPill({ resolved }: { resolved: boolean }) {
  const [bg, color, label] = resolved
    ? ['oklch(62% 0.16 155 / 0.08)', 'oklch(62% 0.16 155)', 'Clôturée']
    : ['oklch(55% 0.22 25 / 0.08)', 'oklch(55% 0.22 25)', 'Ouverte'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {label}
    </span>
  );
}

// ─── Dashboard ───

export function Dashboard({ onResolveAlert: _onResolveAlert, alerts, auditTrail }: DashboardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.dashboard.stats().then(setStats).catch(() => {});
  }, []);

  const recentAlerts = alerts.slice(0, 5);
  const recentAudit = auditTrail.slice(0, 6);

  const totalMembers = stats?.totalMembersAll ?? 0;
  const totalAccess = stats?.totalAccessRights ?? 0;
  const avgScore = stats?.avgRiskScore ?? 0;
  const openAlerts = alerts.filter(a => !a.is_resolved).length;

  const riskDist = stats?.riskDistribution ?? { crit: 0, high: 0, med: 0, low: 0 };
  const adminCount      = stats?.adminCount ?? 0;
  const mfaDisabled     = stats?.mfaDisabledCount ?? 0;
  const inactiveAccess  = stats?.inactiveWithAccess ?? 0;
  const multiPlatform   = stats?.multiPlatformCount ?? 0;

  const feedDotColor = (entry: AuditTrail) =>
    entry.action.includes('delete') || entry.action.includes('revoke') ? 'oklch(55% 0.22 25)'
    : entry.action.includes('create') || entry.action.includes('add') ? 'oklch(62% 0.16 155)'
    : 'oklch(42% 0.18 280)';

  const cardStyle: React.CSSProperties = {
    background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, display: 'flex', flexDirection: 'column',
  };
  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: 10,
  };
  const thStyle: React.CSSProperties = {
    textAlign: 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = { padding: '12px 20px', verticalAlign: 'middle', color: 'oklch(18% 0.02 260)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Topbar row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Vue d'ensemble</div>
          <div style={{ fontSize: 12, color: 'oklch(52% 0.012 260)' }}>Tracix — Plateforme de gestion des accès</div>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button className="hidden sm:inline-flex" style={{ alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)' }}>
            <SlidersHorizontal size={14} /> Filtres
          </button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none' }}>
            <Download size={14} /> Exporter
          </button>
        </div>
      </div>

      {/* KPI grid — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Membres actifs" value={totalMembers} delta={stats ? `${totalMembers} au total` : '—'} kpiColor="oklch(42% 0.18 280)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(42% 0.18 280)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <KpiCard label="Habilitations actives" value={totalAccess} delta={stats ? `${stats.adminCount} droits admin` : '—'} kpiColor="oklch(55% 0.18 280)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(55% 0.18 280)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
        />
        <KpiCard label="Score de risque moyen" value={avgScore} delta={stats ? `${stats.membersWithoutReview} revues en retard` : '—'} deltaUp={stats ? (stats.membersWithoutReview > 0 ? false : undefined) : undefined} kpiColor="oklch(70% 0.14 88)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(70% 0.14 88)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
        <KpiCard label="Alertes ouvertes" value={openAlerts} delta={stats ? `${stats.criticalAlerts} critique${stats.criticalAlerts !== 1 ? 's' : ''}` : '—'} deltaUp={openAlerts > 0 ? false : undefined} kpiColor="oklch(55% 0.22 25)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(55% 0.22 25)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
        />
      </div>

      {/* row-3: 2fr 1fr */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Risk distribution */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Distribution des niveaux de risque</span>
            <span style={{ fontSize: 11, color: 'oklch(52% 0.012 260)' }}>— {totalMembers} membres</span>
            <div style={{ marginLeft: 'auto' }}>
              <Link to="/score-risque" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', textDecoration: 'none' }}>
                7 derniers jours
              </Link>
            </div>
          </div>
          <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RiskBar label="Critique" count={riskDist.crit} total={totalMembers} color="oklch(55% 0.22 25)" />
            <RiskBar label="Élevé"    count={riskDist.high} total={totalMembers} color="oklch(62% 0.18 52)" />
            <RiskBar label="Moyen"    count={riskDist.med}  total={totalMembers} color="oklch(70% 0.14 88)" />
            <RiskBar label="Faible"   count={riskDist.low}  total={totalMembers} color="oklch(62% 0.16 155)" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', padding: '12px 20px 16px', borderTop: '1px solid oklch(90% 0.006 260)' }}>
            {[
              { label: 'Critique', color: 'oklch(55% 0.22 25)', count: riskDist.crit },
              { label: 'Élevé',    color: 'oklch(62% 0.18 52)', count: riskDist.high },
              { label: 'Moyen',    color: 'oklch(70% 0.14 88)', count: riskDist.med  },
              { label: 'Faible',   color: 'oklch(62% 0.16 155)', count: riskDist.low },
            ].map(item => {
              const pct = totalMembers > 0 ? ((item.count / totalMembers) * 100).toFixed(1) : '0.0';
              return (
                <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'oklch(52% 0.012 260)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                  {item.label} ({pct}%)
                </span>
              );
            })}
          </div>
        </div>

        {/* Score global */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Score global</span>
          </div>
          <Gauge score={avgScore} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
            {[
              { label: 'Accès privilégiés (admin)', val: adminCount,     color: 'oklch(62% 0.18 52)' },
              { label: 'MFA désactivé',             val: mfaDisabled,    color: 'oklch(62% 0.18 52)' },
              { label: 'Inactifs avec accès',       val: inactiveAccess, color: 'oklch(70% 0.14 88)' },
              { label: 'Accès multi-plateformes',   val: multiPlatform,  color: 'oklch(70% 0.14 88)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '0 20px' }}>
                <span style={{ color: 'oklch(52% 0.012 260)' }}>{row.label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: row.color }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* row-2: 1fr 1fr */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alertes récentes */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Alertes récentes</span>
            <span style={{ fontSize: 11, color: 'oklch(52% 0.012 260)' }}>— {openAlerts} ouvertes</span>
            <div style={{ marginLeft: 'auto' }}>
              <Link to="/alertes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', textDecoration: 'none' }}>
                Tout voir →
              </Link>
            </div>
          </div>
          {recentAlerts.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Alerte', 'Membre', 'Sévérité', 'Statut', 'Détectée'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((alert) => (
                    <tr key={alert.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', transition: 'background 0.1s', cursor: 'pointer' }}
                      onClick={() => navigate('/alertes')}
                      onMouseEnter={e => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={tdStyle}>{alert.message}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'oklch(42% 0.12 280 / 0.12)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'oklch(42% 0.18 280)', flexShrink: 0 }}>
                            {(alert.source_label || 'U').charAt(0).toUpperCase()}
                          </div>
                          {alert.source_label}
                        </div>
                      </td>
                      <td style={tdStyle}><SevPill sev={alert.severity} /></td>
                      <td style={tdStyle}><StatusPill resolved={alert.is_resolved} /></td>
                      <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'oklch(52% 0.012 260)' }}>
                        {new Date(alert.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <CheckCircle2 style={{ width: 40, height: 40, color: 'oklch(62% 0.16 155)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: 'oklch(52% 0.012 260)' }}>Aucune alerte en cours</p>
            </div>
          )}
        </div>

        {/* Activité récente */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Activité récente</span>
            <div style={{ marginLeft: 'auto' }}>
              <Link to="/journal" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', textDecoration: 'none' }}>
                Journal →
              </Link>
            </div>
          </div>
          {recentAudit.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentAudit.map((entry, idx) => (
                <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '13px 20px', borderBottom: idx < recentAudit.length - 1 ? '1px solid oklch(90% 0.006 260)' : 'none', transition: 'background 0.1s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: feedDotColor(entry), flexShrink: 0 }} />
                    {idx < recentAudit.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: 'oklch(90% 0.006 260)', marginTop: 4 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'oklch(18% 0.02 260)', lineHeight: 1.5 }}>
                      <strong>{entry.actor.split('@')[0]}</strong>
                      {' — '}{entry.action}{' '}
                      <strong>{entry.target_label}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'oklch(52% 0.012 260)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                      {new Date(entry.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <Activity style={{ width: 40, height: 40, color: 'oklch(90% 0.006 260)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: 'oklch(52% 0.012 260)' }}>Aucune action récente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
