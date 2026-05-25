// ═══════════════════════════════════════════
// Page Score de risque — Analyse globale
// ═══════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskColor } from '@/types';
import type { Member, Platform, AccessRight } from '@/types';

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

// ─── Sparkline SVG ───
function Sparkline({ points, color }: { points: [number, number][]; color: string }) {
  const w = 600; const h = 120;
  const pStr = points.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPath = `M${pStr.split(' ').join(' L')} L${points[points.length-1][0]},${h} L${points[0][0]},${h} Z`;
  const [lx, ly] = points[points.length - 1];
  return (
    <div style={{ padding: '20px', position: 'relative', width: '100%', height: '140px' }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '120px', overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="0" x2={w} y2="0" stroke="oklch(90% 0.006 260)" strokeWidth="1" />
        <line x1="0" y1="30" x2={w} y2="30" stroke="oklch(90% 0.006 260)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="60" x2={w} y2="60" stroke="oklch(90% 0.006 260)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="90" x2={w} y2="90" stroke="oklch(90% 0.006 260)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1={h} x2={w} y2={h} stroke="oklch(90% 0.006 260)" strokeWidth="1" />
        <path d={areaPath} fill="url(#areaGrad)" />
        <polyline points={pStr} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r="4" fill={color} />
        <text x="6" y="4"  fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)">80</text>
        <text x="6" y="34" fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)">70</text>
        <text x="6" y="64" fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)">60</text>
        <text x="6" y="94" fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)">50</text>
        <text x="0"   y="118" fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)" textAnchor="start">24 Avr</text>
        <text x={w/2} y="118" fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)" textAnchor="middle">09 Mai</text>
        <text x={w}   y="118" fontSize="10" fontFamily="'JetBrains Mono',ui-monospace,Menlo,monospace" fill="oklch(52% 0.012 260)" textAnchor="end">24 Mai</text>
      </svg>
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
  const [period, setPeriod] = useState<'7j' | '30j' | '90j'>('30j');
  const [chartView, setChartView] = useState<'global' | 'facteurs'>('global');

  const critiques   = members.filter((m) => m.risk_score <= 39).length;
  const elevated    = members.filter((m) => m.risk_score >= 40 && m.risk_score <= 59).length;
  const avgScore    = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.risk_score, 0) / members.length) : 0;
  // Trier par score croissant : les plus bas = plus risqués en premier
  const sorted      = [...members].sort((a, b) => a.risk_score - b.risk_score);
  const median      = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].risk_score : 0;

  // Build sparkline from members' scores (simulated trend with noise)
  const sparkPoints: [number, number][] = Array.from({ length: 30 }, (_, i) => {
    const x = Math.round((i / 29) * 600);
    const baseY = 120 - ((avgScore - 50) / 30) * 120;
    const noise = Math.sin(i * 0.8) * 8 + Math.cos(i * 0.3) * 5;
    return [x, Math.max(5, Math.min(115, Math.round(baseY + noise + (i / 29) * -20)))];
  });

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

  const PERIODS: { id: '7j' | '30j' | '90j'; label: string }[] = [
    { id: '7j', label: '7 j' },
    { id: '30j', label: '30 j' },
    { id: '90j', label: '90 j' },
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
          {PERIODS.map(({ id, label }) => {
            const isActive = period === id;
            return (
              <button key={id} onClick={() => setPeriod(id)}
                style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 500, borderRadius: '7px', border: `1px solid ${isActive ? 'oklch(42% 0.18 280)' : 'oklch(90% 0.006 260)'}`, background: isActive ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent', color: isActive ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)', cursor: 'pointer' }}>
                {label}
              </button>
            );
          })}
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', marginLeft: '6px' }}>
            Rapport PDF
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        <KpiCard label="Score moyen global" value={avgScore} delta={members.length > 0 ? `${members.length} membres évalués` : '—'} deltaDir={avgScore <= 59 ? 'down' : avgScore >= 80 ? 'up' : 'neutral'} color={riskScoreColor(avgScore)} svgPath="M22 12h-4l-3 9-6-18-3 9H2" />
        <KpiCard label="Score le plus bas (≤ 39)" value={critiques} delta={critiques > 0 ? `${((critiques / Math.max(1, members.length)) * 100).toFixed(1)}% des membres` : '→ Aucun'} deltaDir={critiques > 0 ? 'down' : 'neutral'} color="oklch(55% 0.22 25)" svgPath="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01" />
        <KpiCard label="Score risqué (40–59)" value={elevated} delta={elevated > 0 ? `${((elevated / Math.max(1, members.length)) * 100).toFixed(1)}% des membres` : '→ Aucun'} deltaDir={elevated > 0 ? 'down' : 'neutral'} color="oklch(62% 0.18 52)" svgPath="M12 2a10 10 0 100 20A10 10 0 0012 2z M12 8v4 M12 16h.01" />
        <KpiCard label="Score médian (P50)" value={median} delta={sorted.length > 0 ? `sur ${sorted.length} membres actifs` : '—'} deltaDir="neutral" color="oklch(62% 0.16 155)" svgPath="M5 12h14 M12 5l7 7-7 7" />
      </div>

      {/* Row 2/3 + 1/3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Sparkline card */}
        <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Évolution du score moyen</span>
            <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)' }}>— 30 derniers jours</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {(['global', 'facteurs'] as const).map((v) => {
                const active = chartView === v;
                return (
                  <button key={v} onClick={() => setChartView(v)}
                    style={{ padding: '5px 10px', fontSize: '11.5px', fontWeight: 500, borderRadius: '7px', cursor: 'pointer',
                      border: `1px solid ${active ? 'oklch(42% 0.18 280)' : 'oklch(90% 0.006 260)'}`,
                      background: active ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent',
                      color: active ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)' }}>
                    {v === 'global' ? 'Score global' : 'Par facteur'}
                  </button>
                );
              })}
            </div>
          </div>
          {chartView === 'global' ? (
            <Sparkline points={sparkPoints} color="oklch(70% 0.14 88)" />
          ) : (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {factors.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '160px', fontSize: '12px', color: 'oklch(35% 0.012 260)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{f.name}</div>
                  <div style={{ flex: 1, height: '8px', background: 'oklch(90% 0.006 260)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: f.color, width: `${f.score}%`, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ width: '32px', textAlign: 'right', fontSize: '13px', fontWeight: 700, fontFamily: "'JetBrains Mono',ui-monospace,monospace", color: f.color, flexShrink: 0 }}>{f.score}</span>
                </div>
              ))}
            </div>
          )}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Top 10 membres à risque</span>
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
                {sorted.slice(0, 10).map((m) => {
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
                {sorted.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '48px 20px', textAlign: 'center', color: 'oklch(52% 0.012 260)', fontSize: '13px' }}>Aucun membre</td></tr>
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
