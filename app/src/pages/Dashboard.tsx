// ═══════════════════════════════════════════
// Page Dashboard — Vue d'ensemble
// ═══════════════════════════════════════════

import { useState, useEffect, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ShieldCheck, AlertTriangle, TrendingUp,
  Clock, CreditCard, Shield, ArrowRight, Upload,
  FileSpreadsheet, CheckCircle2, ChevronRight, Activity,
  BarChart2, PieChart as PieChartLucide, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
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

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#1D9E75' : score >= 50 ? '#EF9F27' : '#E24B4A';
  const label = score >= 80 ? 'Bonne santé' : score >= 50 ? 'À surveiller' : 'Risques élevés';
  const circumference = 251.3;
  const dash = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center h-[200px] gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-[9px] text-gray-400 font-medium">/100</span>
        </div>
      </div>
      <span className="text-sm font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

function ChartPlaceholder({ icon: Icon, text }: { icon: ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-center gap-2">
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
  const recentAudit = auditTrail.slice(0, 5);

  const isFirstTime = stats !== null && stats.totalMembersAll === 0 && stats.totalPlatforms === 0;
  const hasTeamData = (stats?.riskByTeam?.length ?? 0) > 0;
  const hasAccessData = (stats?.accessLevelDistribution?.length ?? 0) > 0;
  const hasRiskHistory = (stats?.riskHistory?.length ?? 0) > 0;
  const healthScore = stats && !isFirstTime ? computeHealthScore(stats) : 0;

  const riskByTeam = stats?.riskByTeam ?? [];
  const accessDist = stats?.accessLevelDistribution ?? [];
  const riskHistory = stats?.riskHistory ?? [];

  // ─── Premier démarrage ───
  if (isFirstTime) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bienvenue sur Tracix !</p>
        </div>

        {/* Hero d'accueil */}
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

        {/* 3 étapes */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              step: 1,
              icon: FileSpreadsheet,
              title: 'Importer vos données',
              desc: "Chargez votre fichier Excel — membres, équipes, plateformes et niveaux d'accès sont détectés automatiquement.",
              to: '/import',
              cta: 'Importer maintenant',
            },
            {
              step: 2,
              icon: Users,
              title: 'Vérifier les habilitations',
              desc: 'Après l\'import, consultez la matrice des accès et identifiez les droits excessifs.',
              to: '/habilitations',
              cta: 'Voir les habilitations',
            },
            {
              step: 3,
              icon: AlertTriangle,
              title: 'Configurer les alertes',
              desc: 'Soyez notifié en cas de changement critique sur vos accès et vos comptes Admin.',
              to: '/alertes',
              cta: 'Voir les alertes',
            },
          ].map(({ step, icon: Icon, title, desc, to, cta }) => (
            <div key={step} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#534AB7]/40 hover:shadow-sm transition-all">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#534AB7] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
                  {step}
                </div>
                <Icon className="w-4 h-4 text-[#534AB7]" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 mb-1.5">{title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{desc}</p>
              <Link
                to={to}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#534AB7] hover:underline"
              >
                {cta} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>

        {/* Formats supportés */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-700 mb-2.5">Colonnes Excel reconnues automatiquement</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {[
              'Nom / Prénom',
              'Équipe / Département',
              'Email',
              'Plateforme (une colonne par plateforme)',
              'Niveau accès : Admin · RW · RO',
            ].map((tip) => (
              <div key={tip} className="flex items-center gap-1.5 text-xs text-indigo-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── KPIs ───
  const kpis = stats
    ? [
        { label: 'Membres actifs', value: `${stats.totalMembers}/${stats.totalMembersAll}`, icon: Users, color: '#534AB7' },
        { label: 'Plateformes', value: stats.totalPlatforms, icon: ShieldCheck, color: '#1D9E75' },
        { label: 'Comptes Admin', value: stats.adminCount, icon: Shield, color: stats.adminCount > 9 ? '#E24B4A' : '#EF9F27' },
        { label: 'Revues en retard', value: stats.overdueReviews, icon: Clock, color: stats.overdueReviews > 0 ? '#E24B4A' : '#1D9E75' },
        { label: 'Score risque moyen', value: stats.avgRiskScore, icon: TrendingUp, color: getRiskColor(stats.avgRiskScore) },
        { label: 'Sans revue >90j', value: stats.membersWithoutReview, icon: AlertTriangle, color: stats.membersWithoutReview > 0 ? '#E24B4A' : '#1D9E75' },
        { label: 'Abos expirant', value: stats.expiringSubs, icon: CreditCard, color: '#EF9F27' },
        { label: 'Alertes critiques', value: stats.criticalAlerts, icon: AlertTriangle, color: stats.criticalAlerts > 0 ? '#E24B4A' : '#1D9E75' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de votre organisation</p>
        </div>
        <Link
          to="/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors w-fit"
        >
          <Upload className="w-4 h-4" />
          Importer un Excel
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
        {!stats &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-100 mb-2" />
              <div className="h-6 w-12 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Score de risque par équipe */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Score de risque par équipe</h3>
          {hasTeamData ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={riskByTeam} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="team" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {riskByTeam.map((entry) => (
                    <Cell key={entry.team} fill={getRiskColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder
              icon={BarChart2}
              text="Importez des membres avec des équipes pour voir les scores de risque"
            />
          )}
        </div>

        {/* Répartition des accès */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Répartition des accès</h3>
          {hasAccessData ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={accessDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {accessDist.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                {accessDist.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-gray-600">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ChartPlaceholder
              icon={PieChartLucide}
              text="Aucun droit d'accès enregistré — importez votre matrice d'habilitations"
            />
          )}
        </div>

        {/* Santé globale ou Évolution du risque */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {hasRiskHistory ? (
            <>
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Évolution du risque (30j)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={riskHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="#534AB7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : stats ? (
            <>
              <h3 className="text-sm font-semibold text-gray-800 mb-0.5">Santé globale</h3>
              <p className="text-[11px] text-gray-400 mb-2">Calculé à partir des alertes, revues et risques</p>
              <HealthGauge score={healthScore} />
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Santé globale</h3>
              <ChartPlaceholder icon={Activity} text="Chargement…" />
            </>
          )}
        </div>
      </div>

      {/* Alertes + Journal */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alertes en cours */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Alertes en cours</h3>
            <Link to="/alertes" className="text-xs text-[#534AB7] hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <div key={alert.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-500">{alert.source_label}</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">{alert.message}</p>
                  </div>
                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="text-[11px] text-gray-500 hover:text-[#534AB7] underline flex-shrink-0"
                  >
                    Résoudre
                  </button>
                </div>
              );
            })}
            {recentAlerts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucune alerte en cours</p>
            )}
          </div>
        </div>

        {/* Dernières actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Dernières actions</h3>
            <Link to="/journal" className="text-xs text-[#534AB7] hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentAudit.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-[#534AB7] mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">
                    <span className="font-medium">{entry.actor.split('@')[0]}</span>
                    {' '}<span className="text-gray-400">{entry.action}</span>{' '}
                    <span className="font-medium">{entry.target_label}</span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(entry.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
            {recentAudit.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucune action récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
