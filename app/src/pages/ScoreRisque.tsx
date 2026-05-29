// ═══════════════════════════════════════════
// Page Score de risque — Analyse globale
// ═══════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskColor } from '@/types';
import type { Member, Platform, AccessRight } from '@/types';
import { api, type RiskSnapshot } from '@/lib/api';

interface ScoreRisqueProps {
  members: Member[];
  platforms: Platform[];
  accessRights: AccessRight[];
}

// ─── Shared helpers — risk_score est un score de conformité (100 = bon, 0 = dangereux) ───
function riskPillVariant(score: number): 'crit' | 'high' | 'med' | 'low' {
  if (score <= 39) return 'crit';
  if (score <= 59) return 'high';
  if (score <= 79) return 'med';
  return 'low';
}
function riskPillLabel(score: number): string {
  if (score <= 39) return 'Critique';
  if (score <= 59) return 'Élevé';
  if (score <= 79) return 'Moyen';
  return 'Faible';
}
function riskScoreColor(score: number): string {
  if (score <= 39) return 'oklch(55% 0.22 25)';
  if (score <= 59) return 'oklch(62% 0.18 52)';
  if (score <= 79) return 'oklch(70% 0.14 88)';
  return 'oklch(62% 0.16 155)';
}

function Pill({ variant, children }: { variant: 'crit' | 'high' | 'med' | 'low' | 'brand'; children: React.ReactNode }) {
  const s: Record<string, React.CSSProperties> = {
    crit:  { background: 'oklch(55% 0.22 25 / 0.1)',  color: 'oklch(55% 0.22 25)' },
    high:  { background: 'oklch(62% 0.18 52 / 0.1)',  color: 'oklch(62% 0.18 52)' },
    med:   { background: 'oklch(70% 0.14 88 / 0.1)',  color: 'oklch(70% 0.14 88)' },
    low:   { background: 'oklch(62% 0.16 155 / 0.1)', color: 'oklch(62% 0.16 155)' },
    brand: { background: 'oklch(42% 0.18 280 / 0.12)', color: 'oklch(42% 0.18 280)' },
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', ...s[variant] }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {children}
    </span>
  );
}

function KpiCard({ label, value, delta, deltaDir, color, svgPath }: { label: string; value: string | number; delta: string; deltaDir: 'up' | 'down' | 'neutral'; color: string; svgPath: string }) {
  const deltaColor = deltaDir === 'up' ? 'oklch(62% 0.16 155)' : deltaDir === 'down' ? 'oklch(55% 0.22 25)' : 'oklch(52% 0.012 260)';
  return (
    <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color, borderRadius: '10px 10px 0 0' }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '8px', background: color, opacity: 0.12 }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
          <path d={svgPath} />
        </svg>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: 'oklch(18% 0.02 260)' }}>{value}</div>
      <div style={{ fontSize: '11.5px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: deltaColor }}>{delta}</div>
    </div>
  );
}

// ─── Sparkline — évolution réelle depuis les snapshots ───
function Sparkline({ snapshots, period }: { snapshots: RiskSnapshot[]; period: 7 | 30 | 90 }) {
  const W = 560; const H = 110; const PAD_LEFT = 28; const PAD_BOTTOM = 18;
  const innerW = W - PAD_LEFT; const innerH = H - PAD_BOTTOM;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);
  const pts = snapshots.filter((s) => s.date >= cutoff.toISOString().split('T')[0]);

  if (pts.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', color: 'oklch(62% 0.012 260)', fontSize: '13px' }}>
        Pas encore assez de données — le graphique se remplira au fil des jours.
      </div>
    );
  }

  const minScore = Math.max(0, Math.min(...pts.map((p) => p.avg_score)) - 5);
  const maxScore = Math.min(100, Math.max(...pts.map((p) => p.avg_score)) + 5);
  const range = maxScore - minScore || 1;

  const toX = (i: number) => PAD_LEFT + Math.round((i / (pts.length - 1)) * innerW);
  const toY = (v: number) => Math.round(innerH - ((v - minScore) / range) * innerH);

  const polyPts = pts.map((p, i) => `${toX(i)},${toY(p.avg_score)}`).join(' ');
  const areaD = `M${toX(0)},${toY(pts[0].avg_score)} ` +
    pts.slice(1).map((p, i) => `L${toX(i + 1)},${toY(p.avg_score)}`).join(' ') +
    ` L${toX(pts.length - 1)},${innerH} L${toX(0)},${innerH} Z`;

  const color = 'oklch(42% 0.18 280)';
  const last = pts[pts.length - 1];

  const yLabels = [maxScore, (maxScore + minScore) / 2, minScore].map(Math.round);

  return (
    <div style={{ padding: '16px 20px 8px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '130px', overflow: 'visible' }}>
        <defs>
          <linearGradient id="snapGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yLabels.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PAD_LEFT} y1={y} x2={W} y2={y} stroke="oklch(90% 0.006 260)" strokeWidth="1" strokeDasharray={i === 0 ? '' : '3 3'} />
              <text x={PAD_LEFT - 4} y={y + 4} fontSize="9" fontFamily="'JetBrains Mono',ui-monospace,monospace" fill="oklch(55% 0.012 260)" textAnchor="end">{v}</text>
            </g>
          );
        })}
        <line x1={PAD_LEFT} y1={innerH} x2={W} y2={innerH} stroke="oklch(90% 0.006 260)" strokeWidth="1" />
        <path d={areaD} fill="url(#snapGrad)" />
        <polyline points={polyPts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={toX(pts.length - 1)} cy={toY(last.avg_score)} r="4" fill={color} />
        <text x={toX(0)} y={H} fontSize="9" fontFamily="'JetBrains Mono',ui-monospace,monospace" fill="oklch(55% 0.012 260)" textAnchor="start">{pts[0].date.slice(5)}</text>
        <text x={W} y={H} fontSize="9" fontFamily="'JetBrains Mono',ui-monospace,monospace" fill="oklch(55% 0.012 260)" textAnchor="end">{last.date.slice(5)}</text>
      </svg>
    </div>
  );
}

// ─── Histogram — distribution réelle des scores ───
const BANDS = [
  { label: '0–39',   sublabel: 'Critique', color: 'oklch(55% 0.22 25)',   bg: 'oklch(55% 0.22 25 / 0.12)'  },
  { label: '40–59',  sublabel: 'Élevé',    color: 'oklch(62% 0.18 52)',   bg: 'oklch(62% 0.18 52 / 0.12)'  },
  { label: '60–79',  sublabel: 'Modéré',   color: 'oklch(70% 0.14 88)',   bg: 'oklch(70% 0.14 88 / 0.12)'  },
  { label: '80–100', sublabel: 'Conforme', color: 'oklch(62% 0.16 155)',  bg: 'oklch(62% 0.16 155 / 0.12)' },
];

function Histogram({ members }: { members: { risk_score: number }[] }) {
  const counts = [
    members.filter((m) => m.risk_score <= 39).length,
    members.filter((m) => m.risk_score >= 40 && m.risk_score <= 59).length,
    members.filter((m) => m.risk_score >= 60 && m.risk_score <= 79).length,
    members.filter((m) => m.risk_score >= 80).length,
  ];
  const total = members.length || 1;
  const max = Math.max(...counts, 1);

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {BANDS.map((band, i) => {
        const count = counts[i];
        const pct = Math.round((count / total) * 100);
        const barW = Math.round((count / max) * 100);
        return (
          <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '72px', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: band.color }}>{band.sublabel}</div>
              <div style={{ fontSize: '10px', color: 'oklch(62% 0.012 260)', fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>{band.label}</div>
            </div>
            <div style={{ flex: 1, height: '22px', background: 'oklch(94% 0.004 260)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${barW}%`, background: band.color, borderRadius: '6px', opacity: 0.85, transition: 'width 0.5s ease' }} />
              {count > 0 && (
                <span style={{ position: 'absolute', left: `${Math.min(barW + 1, 70)}%`, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: 600, color: barW > 50 ? '#fff' : band.color, fontFamily: "'JetBrains Mono',ui-monospace,monospace", whiteSpace: 'nowrap' }}>
                  {count} membre{count > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ width: '36px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: band.color, fontFamily: "'JetBrains Mono',ui-monospace,monospace", flexShrink: 0 }}>{pct}%</div>
          </div>
        );
      })}
      {members.length === 0 && (
        <p style={{ textAlign: 'center', color: 'oklch(62% 0.012 260)', fontSize: '13px', padding: '16px 0' }}>Aucun membre évalué</p>
      )}
    </div>
  );
}

// ─── Gauge SVG ───
function Gauge({ score, color }: { score: number; color: string }) {
  const circumference = Math.PI * 64;
  const dashOffset = circumference * (1 - score / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', gap: '6px' }}>
      <svg width="160" height="96" viewBox="0 0 160 96">
        <defs>
          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(62% 0.16 155)" />
            <stop offset="60%" stopColor="oklch(70% 0.14 88)" />
            <stop offset="100%" stopColor="oklch(62% 0.18 52)" />
          </linearGradient>
        </defs>
        <path d="M16 88 A64 64 0 0 1 144 88" stroke="oklch(90% 0.006 260)" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d="M16 88 A64 64 0 0 1 144 88" stroke="url(#gGrad)" strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset} />
      </svg>
      <div style={{ fontSize: '42px', fontWeight: 700, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color }}>{score}</div>
      <div style={{ fontSize: '13px', color: 'oklch(52% 0.012 260)' }}>/ 100</div>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: '999px', background: `${color}1e`, color }}>
        {score <= 39 ? 'Risque critique' : score <= 59 ? 'Risque élevé' : score <= 79 ? 'Risque modéré' : 'Risque faible'}
      </span>
    </div>
  );
}

export function ScoreRisque({ members, platforms, accessRights }: ScoreRisqueProps) {
  const navigate = useNavigate();
  const [riskFilter, setRiskFilter] = useState<'all' | 'crit' | 'high' | 'med' | 'low'>('all');
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [snapshots, setSnapshots] = useState<RiskSnapshot[]>([]);
  const [chartView, setChartView] = useState<'evolution' | 'facteurs'>('evolution');

  useEffect(() => {
    api.riskSnapshots.list(90).then(setSnapshots).catch(() => {});
  }, []);

  const critiques   = members.filter((m) => m.risk_score <= 39).length;
  const elevated    = members.filter((m) => m.risk_score >= 40 && m.risk_score <= 59).length;
  const avgScore    = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.risk_score, 0) / members.length) : 0;
  // Trier par score croissant : les plus bas = plus risqués en premier
  const sorted      = [...members].sort((a, b) => a.risk_score - b.risk_score);
  const median      = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].risk_score : 0;

  const filteredTop = riskFilter === 'all' ? sorted
    : riskFilter === 'crit' ? sorted.filter((m) => m.risk_score <= 39)
    : riskFilter === 'high' ? sorted.filter((m) => m.risk_score >= 40 && m.risk_score <= 59)
    : riskFilter === 'med'  ? sorted.filter((m) => m.risk_score >= 60 && m.risk_score <= 79)
    : sorted.filter((m) => m.risk_score >= 80);

  // Risk factors from actual data
  const adminCount    = accessRights.filter((a) => a.level === 'admin').length;
  const noMfaAdmins   = platforms.filter((p) => !p.has_mfa).length;
  const expiredRights = accessRights.filter((a) => a.next_review_date && new Date(a.next_review_date) < new Date()).length;
  const inactiveMembers = members.filter((m) => m.status === 'inactif').length;
  const multiPlatform   = members.filter((m) => {
    const count = accessRights.filter((a) => a.member_id === m.id && a.level !== 'none').length;
    return count >= 5;
  }).length;

  const factors = [
    { name: 'Accès privilégiés non révisés', desc: `${adminCount} compte${adminCount !== 1 ? 's' : ''} avec droits admin`, score: Math.min(99, Math.round(adminCount * 0.35)), color: 'oklch(62% 0.18 52)' },
    { name: 'MFA non activé', desc: `${noMfaAdmins} plateforme${noMfaAdmins !== 1 ? 's' : ''} sans authentification forte`, score: Math.min(99, Math.round(noMfaAdmins * 8)), color: 'oklch(62% 0.18 52)' },
    { name: 'Comptes inactifs', desc: `${inactiveMembers} compte${inactiveMembers !== 1 ? 's' : ''} inactif${inactiveMembers !== 1 ? 's' : ''} avec accès encore actifs`, score: Math.min(99, Math.round(inactiveMembers * 1.3)), color: 'oklch(70% 0.14 88)' },
    { name: 'Accès multi-plateformes', desc: `${multiPlatform} membre${multiPlatform !== 1 ? 's' : ''} avec accès sur ≥ 5 services simultanément`, score: Math.min(99, Math.round(multiPlatform * 0.6)), color: 'oklch(70% 0.14 88)' },
    { name: 'Habilitations expirées actives', desc: `${expiredRights} habilitation${expiredRights !== 1 ? 's' : ''} dont la date d'échéance est dépassée`, score: Math.min(99, Math.round(expiredRights * 1.7)), color: 'oklch(70% 0.14 88)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Topbar row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Score de risque</div>
          <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>Analyse globale · {members.length} membres évalués</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => setPeriod(d)}
              style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 500, borderRadius: '7px', cursor: 'pointer',
                border: `1px solid ${period === d ? 'oklch(42% 0.18 280)' : 'oklch(90% 0.006 260)'}`,
                background: period === d ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent',
                color: period === d ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)' }}>
              {d} j
            </button>
          ))}
          <button onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', marginLeft: '6px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard label="Score moyen global" value={avgScore} delta={members.length > 0 ? `${members.length} membres évalués` : '—'} deltaDir={avgScore <= 59 ? 'down' : avgScore >= 80 ? 'up' : 'neutral'} color={riskScoreColor(avgScore)} svgPath="M22 12h-4l-3 9-6-18-3 9H2" />
        <KpiCard label="Score le plus bas (≤ 39)" value={critiques} delta={critiques > 0 ? `${((critiques / Math.max(1, members.length)) * 100).toFixed(1)}% des membres` : '→ Aucun'} deltaDir={critiques > 0 ? 'down' : 'neutral'} color="oklch(55% 0.22 25)" svgPath="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01" />
        <KpiCard label="Score risqué (40–59)" value={elevated} delta={elevated > 0 ? `${((elevated / Math.max(1, members.length)) * 100).toFixed(1)}% des membres` : '→ Aucun'} deltaDir={elevated > 0 ? 'down' : 'neutral'} color="oklch(62% 0.18 52)" svgPath="M12 2a10 10 0 100 20A10 10 0 0012 2z M12 8v4 M12 16h.01" />
        <KpiCard label="Score médian (P50)" value={median} delta={sorted.length > 0 ? `sur ${sorted.length} membres actifs` : '—'} deltaDir="neutral" color="oklch(62% 0.16 155)" svgPath="M5 12h14 M12 5l7 7-7 7" />
      </div>

      {/* Row 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Evolution / Facteurs card */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              {chartView === 'evolution' ? 'Évolution du score moyen' : 'Distribution des scores'}
            </span>
            <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)' }}>
              {chartView === 'evolution' ? `— ${period} derniers jours` : `— ${members.length} membres évalués`}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              {(['evolution', 'facteurs'] as const).map((v) => {
                const active = chartView === v;
                return (
                  <button key={v} onClick={() => setChartView(v)}
                    style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 500, borderRadius: '7px', cursor: 'pointer',
                      border: `1px solid ${active ? 'oklch(42% 0.18 280)' : 'oklch(90% 0.006 260)'}`,
                      background: active ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent',
                      color: active ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)' }}>
                    {v === 'evolution' ? 'Évolution' : 'Distribution'}
                  </button>
                );
              })}
            </div>
          </div>
          {chartView === 'evolution'
            ? <Sparkline snapshots={snapshots} period={period} />
            : <Histogram members={members} />
          }
        </div>

        {/* Gauge */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Score global</span>
          </div>
          <Gauge score={avgScore} color={riskScoreColor(avgScore)} />
        </div>
      </div>

      {/* Row 1/2 + 1/2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Factor list */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Facteurs de risque</span>
            <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', marginLeft: '6px' }}>— Contribution au score global</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {factors.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: i < factors.length - 1 ? '1px solid oklch(90% 0.006 260)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.name}</div>
                  <div style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', marginTop: '1px' }}>{f.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div style={{ width: '100px', height: '6px', background: 'oklch(90% 0.006 260)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: f.color, width: `${f.score}%`, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", width: '28px', textAlign: 'right', color: f.color }}>{f.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 members table */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Membres à risque</span>
            {([
              { id: 'all',  label: 'Tous',     color: 'oklch(42% 0.18 280)' },
              { id: 'crit', label: 'Critique',  color: 'oklch(55% 0.22 25)' },
              { id: 'high', label: 'Élevé',     color: 'oklch(62% 0.18 52)' },
              { id: 'med',  label: 'Modéré',    color: 'oklch(70% 0.14 88)' },
              { id: 'low',  label: 'Conforme',  color: 'oklch(62% 0.16 155)' },
            ] as const).map(({ id, label, color }) => {
              const active = riskFilter === id;
              return (
                <button key={id} onClick={() => setRiskFilter(id)}
                  style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '999px', cursor: 'pointer', border: `1px solid ${active ? color : 'oklch(90% 0.006 260)'}`, background: active ? `${color.replace(')', ' / 0.12)')}` : 'transparent', color: active ? color : 'oklch(52% 0.012 260)' }}>
                  {label}
                </button>
              );
            })}
            <button onClick={() => navigate('/membres')}
              style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: '11.5px', fontWeight: 500, borderRadius: '7px', border: '1px solid oklch(90% 0.006 260)', background: 'transparent', color: 'oklch(52% 0.012 260)', cursor: 'pointer' }}>
              Voir tous →
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Membre', 'Score', 'Niveau', 'Facteur principal'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTop.slice(0, 10).map((m) => {
                  const variant = riskPillVariant(m.risk_score);
                  const facteur = m.risk_factors[0]?.label ?? '—';
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => navigate(`/membres/${m.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '11px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'oklch(42% 0.18 280 / 0.12)', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 700, color: 'oklch(42% 0.18 280)', flexShrink: 0 }}>
                            {m.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{m.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 20px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: riskScoreColor(m.risk_score) }}>{m.risk_score}</span>
                      </td>
                      <td style={{ padding: '11px 20px' }}>
                        <Pill variant={variant}>{riskPillLabel(m.risk_score)}</Pill>
                      </td>
                      <td style={{ padding: '11px 20px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '11px', color: 'oklch(52% 0.012 260)' }}>
                        {facteur}
                      </td>
                    </tr>
                  );
                })}
                {filteredTop.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '48px 20px', textAlign: 'center', color: 'oklch(52% 0.012 260)', fontSize: '13px' }}>Aucun membre dans cette catégorie</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Méthodologie du score */}
      <div style={{ background: 'oklch(98.5% 0.004 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '12px', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="oklch(42% 0.18 280)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(25% 0.012 260)' }}>Comment ce score est calculé</span>
        </div>
        <p style={{ fontSize: '12px', color: 'oklch(45% 0.012 260)', lineHeight: 1.6, marginBottom: '14px' }}>
          Chaque membre commence à <strong>100</strong> (profil entièrement conforme). Des pénalités sont soustraites selon les facteurs de risque détectés.
          Le score final est borné entre 0 et 100.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {[
            { factor: 'Trop d\'accès Admin', penalty: '−20 pts', detail: `Dépasse le seuil d'admins configuré dans Paramètres → Organisation` },
            { factor: 'Revues d\'accès dépassées', penalty: '−15 / −25 / −35 pts', detail: 'Retard < 30j → −15 pts · Retard 30–90j → −25 pts · Retard > 90j → −35 pts' },
            { factor: 'Départ passé + accès actifs', penalty: '−30 pts', detail: 'Date de départ dans le passé, statut encore actif et accès non révoqués' },
            { factor: 'Compte partagé avec droits Admin', penalty: '−15 pts', detail: 'Compte de type « partagé » ou « service » avec au moins un accès admin' },
            { factor: 'Compte partagé sans Admin', penalty: '−10 pts', detail: 'Compte non nominatif, sans droits admin (accès nominatif recommandé)' },
            { factor: 'Admin sur plateforme sans MFA', penalty: '−10 pts', detail: 'Accès admin sur une plateforme où le MFA n\'est pas activé' },
            { factor: 'Membre inactif avec accès actifs', penalty: '−20 pts', detail: 'Statut « inactif » ou « suspendu » mais des droits sont encore en place' },
          ].map(({ factor, penalty, detail }) => (
            <div key={factor} style={{ background: '#fff', border: '1px solid oklch(90% 0.006 260)', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(25% 0.012 260)' }}>{factor}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'oklch(55% 0.22 25)', flexShrink: 0, marginLeft: '8px' }}>{penalty}</span>
              </div>
              <p style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', lineHeight: 1.5, margin: 0 }}>{detail}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'oklch(60% 0.012 260)', marginTop: '12px', lineHeight: 1.5 }}>
          ✦ Le seuil d'admins et le délai de revue sont configurables dans <strong>Paramètres → Organisation</strong>.
          Le recalcul se déclenche automatiquement à chaque modification d'un droit d'accès.
        </p>
      </div>
    </div>
  );
}
