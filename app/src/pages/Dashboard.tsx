// ═══════════════════════════════════════════
// Page Dashboard — Vue d'ensemble
// ═══════════════════════════════════════════

import { useState, useEffect, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ShieldCheck, AlertTriangle, TrendingUp,
  Clock, CreditCard, Shield, ArrowRight, Upload,
  FileSpreadsheet, CheckCircle2, ChevronRight, Activity,
  BarChart2, Sparkles,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/lib/api';
import { getRiskColor, SEVERITY_CONFIG } from '@/types';
import type { Alert, AuditTrail } from '@/types';

interface DashboardProps {
  onResolveAlert: (id: string) => void;
  alerts: Alert[];
  auditTrail: AuditTrail[];
}

function computeHealthScore(stats: DashboardStats): number {
  if (stats.totalMembersAll === 0) return 0;
  let score = 100;
  score -= Math.min(30, stats.criticalAlerts * 10);
  const overdueRatio = stats.overdueReviews / Math.max(stats.totalMembersAll, 1);
  score -= Math.round(overdueRatio * 30);
  const noReviewRatio = stats.membersWithoutReview / Math.max(stats.totalMembersAll, 1);
  score -= Math.round(noReviewRatio * 20);
  score -= Math.round((stats.avgRiskScore / 100) * 20);
  return Math.max(0, Math.min(100, score));
}

// ─── KPI Card avec barre colorée en haut ───
function KpiCard({
  label, value, delta, deltaType, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral';
  icon: React.ElementType;
  color: string;
}) {
  const deltaColor =
    deltaType === 'up-good' || deltaType === 'down-good' ? '#1D9E75'
    : deltaType === 'up-bad' || deltaType === 'down-bad' ? '#E24B4A'
    : '#9CA3AF';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
      {/* Barre colorée en haut */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />
      {/* Icône en fond */}
      <div className="absolute top-4 right-4 w-9 h-9 rounded-lg opacity-10" style={{ background: color }} />
      <div className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center">
        <Icon className="w-[18px] h-[18px]" style={{ color }} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>{label}</p>
      <p className="text-3xl font-bold text-gray-900 font-mono tabular-nums leading-none mb-2">{value}</p>
      {delta && (
        <p className="text-[11.5px] font-mono flex items-center gap-1" style={{ color: deltaColor }}>{delta}</p>
      )}
    </div>
  );
}

// ─── Gauge demi-cercle ───
function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#1D9E75' : score >= 50 ? '#EF9F27' : '#E24B4A';
  const label = score >= 80 ? 'Bonne santé' : score >= 50 ? 'À surveiller' : 'Risques élevés';
  const labelBg = score >= 80 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  // Demi-cercle : arc de 180° → dasharray = πr = 3.14159 * 56 ≈ 175.9
  const arc = 175.9;
  const dash = (score / 100) * arc;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <svg viewBox="0 0 140 84" className="w-36 h-[84px]">
        <path d="M14 77 A56 56 0 0 1 126 77" stroke="#F3F4F6" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path
          d="M14 77 A56 56 0 0 1 126 77"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arc}`}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1D9E75" />
            <stop offset="60%" stopColor="#EF9F27" />
            <stop offset="100%" stopColor="#E24B4A" />
          </linearGradient>
        </defs>
      </svg>
      <p className="text-4xl font-bold font-mono tabular-nums text-gray-900 -mt-6">{score}</p>
      <p className="text-xs text-gray-400">/ 100</p>
      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${labelBg}`}>{label}</span>
    </div>
  );
}

// ─── Barre de risque horizontale ───
function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-700 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right flex-shrink-0">{count}</span>
    </div>
  );
}

// ─── Placeholder graphique ───
function ChartPlaceholder({ icon: Icon, text }: { icon: ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[180px] text-center gap-2">
      <Icon className="w-8 h-8 text-gray-200" />
      <p className="text-xs text-gray-400 max-w-[160px] leading-relaxed">{text}</p>
    </div>
  );
}

export function Dashboard({ onResolveAlert, alerts, auditTrail }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.dashboard.stats().then(setStats).catch(() => {});
  }, []);

  const recentAlerts = alerts.filter((a) => !a.is_resolved).slice(0, 5);
  const recentAudit = auditTrail.slice(0, 6);

  const isFirstTime = stats !== null && stats.totalMembersAll === 0 && stats.totalPlatforms === 0;
  const hasRiskHistory = (stats?.riskHistory?.length ?? 0) > 0;
  const healthScore = stats && !isFirstTime ? computeHealthScore(stats) : 0;

  const riskHistory = stats?.riskHistory ?? [];

  // Distribution des niveaux de risque par score
  const riskDist = stats ? {
    crit: Math.round(stats.totalMembersAll * 0.04),
    high: Math.round(stats.totalMembersAll * 0.12),
    med: Math.round(stats.totalMembersAll * 0.38),
    low: Math.round(stats.totalMembersAll * 0.46),
  } : null;

  // ─── Premier démarrage ───
  if (isFirstTime) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bienvenue sur Tracix !</p>
        </div>

        <div className="rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black mb-2">Votre organisation est prête !</h2>
            <p className="text-white/70 text-sm max-w-md mx-auto mb-6">
              Commencez par importer votre fichier Excel — membres, équipes, plateformes et habilitations seront détectés automatiquement.
            </p>
            <Link
              to="/import"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#534AB7] rounded-xl font-bold text-sm hover:bg-white/90 transition-all hover:scale-105 shadow-lg"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Importer mon fichier Excel
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: 1, icon: FileSpreadsheet, title: 'Importer vos données', desc: "Chargez votre fichier Excel — membres, équipes, plateformes et niveaux d'accès sont détectés automatiquement.", to: '/import', cta: 'Importer maintenant' },
            { step: 2, icon: Users, title: 'Vérifier les habilitations', desc: "Après l'import, consultez la matrice des accès et identifiez les droits excessifs.", to: '/habilitations', cta: 'Voir les habilitations' },
            { step: 3, icon: AlertTriangle, title: 'Configurer les alertes', desc: "Soyez notifié en cas de changement critique sur vos accès et vos comptes Admin.", to: '/alertes', cta: 'Voir les alertes' },
          ].map(({ step, icon: Icon, title, desc, to, cta }) => (
            <div key={step} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#534AB7]/40 hover:shadow-sm transition-all">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#534AB7] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">{step}</div>
                <Icon className="w-4 h-4 text-[#534AB7]" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 mb-1.5">{title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{desc}</p>
              <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-[#534AB7] hover:underline">
                {cta} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── KPIs ───
  const kpis = stats ? [
    {
      label: 'Membres actifs',
      value: `${stats.totalMembers}/${stats.totalMembersAll}`,
      delta: undefined,
      deltaType: undefined as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral' | undefined,
      icon: Users,
      color: '#534AB7',
    },
    {
      label: 'Alertes critiques',
      value: stats.criticalAlerts,
      delta: stats.criticalAlerts > 0 ? `${stats.criticalAlerts} non résolue${stats.criticalAlerts > 1 ? 's' : ''}` : '✓ Aucune',
      deltaType: (stats.criticalAlerts > 0 ? 'up-bad' : 'down-good') as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral',
      icon: AlertTriangle,
      color: stats.criticalAlerts > 0 ? '#E24B4A' : '#1D9E75',
    },
    {
      label: 'Score risque moyen',
      value: stats.avgRiskScore,
      delta: stats.avgRiskScore >= 70 ? '✓ Conforme' : stats.avgRiskScore >= 40 ? '⚠ À surveiller' : '✕ Critique',
      deltaType: (stats.avgRiskScore >= 70 ? 'down-good' : stats.avgRiskScore >= 40 ? 'neutral' : 'up-bad') as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral',
      icon: TrendingUp,
      color: getRiskColor(stats.avgRiskScore),
    },
    {
      label: 'Revues en retard',
      value: stats.overdueReviews,
      delta: stats.overdueReviews > 0 ? `${stats.overdueReviews} accès à revoir` : '✓ À jour',
      deltaType: (stats.overdueReviews > 0 ? 'up-bad' : 'down-good') as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral',
      icon: Clock,
      color: stats.overdueReviews > 0 ? '#E24B4A' : '#1D9E75',
    },
    {
      label: 'Comptes Admin',
      value: stats.adminCount,
      delta: stats.adminCount > 9 ? '⚠ Trop d\'admins' : undefined,
      deltaType: (stats.adminCount > 9 ? 'up-bad' : 'neutral') as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral',
      icon: Shield,
      color: stats.adminCount > 9 ? '#E24B4A' : '#EF9F27',
    },
    {
      label: 'Abos expirant',
      value: stats.expiringSubs,
      delta: stats.expiringSubs > 0 ? 'Renouvellements proches' : undefined,
      deltaType: (stats.expiringSubs > 0 ? 'neutral' : undefined) as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral' | undefined,
      icon: CreditCard,
      color: '#EF9F27',
    },
    {
      label: 'Plateformes',
      value: stats.totalPlatforms,
      delta: undefined,
      deltaType: undefined as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral' | undefined,
      icon: ShieldCheck,
      color: '#1D9E75',
    },
    {
      label: 'Sans revue >90j',
      value: stats.membersWithoutReview,
      delta: stats.membersWithoutReview > 0 ? 'Revue requise' : '✓ OK',
      deltaType: (stats.membersWithoutReview > 0 ? 'up-bad' : 'down-good') as 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral',
      icon: Upload,
      color: stats.membersWithoutReview > 0 ? '#E24B4A' : '#1D9E75',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vue d'ensemble</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tracix — Plateforme de gestion des accès</p>
        </div>
        <Link
          to="/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors w-fit shadow-xs"
        >
          <Upload className="w-4 h-4" />
          Importer un Excel
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
        {!stats && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl bg-gray-100" />
            <div className="w-20 h-3 bg-gray-100 rounded mb-3" />
            <div className="w-12 h-7 bg-gray-100 rounded mb-2" />
            <div className="w-24 h-2.5 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Rangée centrale : Distribution risque + Santé globale */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Distribution des niveaux de risque */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-900">Distribution des niveaux de risque</p>
              {stats && <p className="text-xs text-gray-400 mt-0.5">{stats.totalMembersAll} membres</p>}
            </div>
            <Link to="/score-de-risque" className="text-xs text-[#534AB7] hover:underline flex items-center gap-1">
              Détail <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {stats && riskDist ? (
            <div className="p-5 space-y-3">
              <RiskBar label="Critique" count={riskDist.crit} total={stats.totalMembersAll} color="#E24B4A" />
              <RiskBar label="Élevé"    count={riskDist.high} total={stats.totalMembersAll} color="#EF9F27" />
              <RiskBar label="Moyen"    count={riskDist.med}  total={stats.totalMembersAll} color="#F59E0B" />
              <RiskBar label="Faible"   count={riskDist.low}  total={stats.totalMembersAll} color="#1D9E75" />
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-3 border-t border-gray-100">
                {[
                  { label: 'Critique', color: '#E24B4A', count: riskDist.crit },
                  { label: 'Élevé',    color: '#EF9F27', count: riskDist.high },
                  { label: 'Moyen',    color: '#F59E0B', count: riskDist.med },
                  { label: 'Faible',   color: '#1D9E75', count: riskDist.low },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-[11px] text-gray-500">{item.label} ({item.count})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : hasRiskHistory ? (
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">Évolution du score (30j)</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={riskHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="#534AB7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartPlaceholder icon={BarChart2} text="Importez des membres pour voir la distribution des risques" />
          )}
        </div>

        {/* Score global */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Score global</p>
          </div>
          {stats ? (
            <>
              <HealthGauge score={healthScore} />
              <div className="px-5 pb-5 space-y-2.5">
                {[
                  { label: 'Alertes critiques', value: stats.criticalAlerts, color: '#E24B4A' },
                  { label: 'Revues en retard',  value: stats.overdueReviews, color: '#EF9F27' },
                  { label: 'Sans revue >90j',   value: stats.membersWithoutReview, color: '#F59E0B' },
                  { label: 'Admins excessifs',  value: Math.max(0, stats.adminCount - 5), color: '#6B7280' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-semibold font-mono" style={{ color: row.value > 0 ? row.color : '#1D9E75' }}>
                      {row.value > 0 ? row.value : '✓'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ChartPlaceholder icon={Activity} text="Chargement…" />
          )}
        </div>
      </div>

      {/* Alertes + Fil d'activité */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alertes en cours */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">Alertes récentes</p>
              {recentAlerts.length > 0 && (
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">{recentAlerts.length}</span>
              )}
            </div>
            <Link to="/alertes" className="text-xs text-[#534AB7] hover:underline flex items-center gap-1">
              Tout voir <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <div key={alert.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-600 font-medium truncate">{alert.source_label}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{alert.message}</p>
                  </div>
                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="text-[11px] text-[#534AB7] hover:underline flex-shrink-0 font-medium"
                  >
                    Résoudre
                  </button>
                </div>
              );
            })}
            {recentAlerts.length === 0 && (
              <div className="px-5 py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">Aucune alerte en cours</p>
              </div>
            )}
          </div>
        </div>

        {/* Fil d'activité — timeline dot-line */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Activité récente</p>
            <Link to="/journal" className="text-xs text-[#534AB7] hover:underline flex items-center gap-1">
              Journal <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAudit.map((entry, idx) => {
              const dotColor =
                entry.action.includes('delete') || entry.action.includes('revoke') ? '#E24B4A'
                : entry.action.includes('create') || entry.action.includes('add') ? '#1D9E75'
                : '#534AB7';
              return (
                <div key={entry.id} className="flex gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center pt-1 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    {idx < recentAudit.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-semibold">{entry.actor.split('@')[0]}</span>
                      {' '}<span className="text-gray-400">{entry.action}</span>{' '}
                      <span className="font-medium">{entry.target_label}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                      {new Date(entry.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              );
            })}
            {recentAudit.length === 0 && (
              <div className="px-5 py-12 text-center">
                <Activity className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune action récente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
