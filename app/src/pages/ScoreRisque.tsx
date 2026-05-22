import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ShieldCheck, TrendingUp, ChevronRight,
  AlertTriangle, BarChart2, Shield, Activity,
} from 'lucide-react';
import { getRiskColor } from '@/types';
import type { Member, Platform, AccessRight } from '@/types';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { PlatformIcon } from '@/components/ui/PlatformIcon';

interface ScoreRisqueProps {
  members: Member[];
  platforms: Platform[];
  accessRights: AccessRight[];
}

function StatCard({
  label,
  value,
  sub,
  bg,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: number | string;
  sub?: string;
  bg: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function ScoreRisque({ members, platforms, accessRights }: ScoreRisqueProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<'membre' | 'plateforme'>('membre');

  // Calcul stats globales
  const critiques = members.filter((m) => m.risk_score >= 70).length;
  const aRisque = members.filter((m) => m.risk_score >= 40 && m.risk_score < 70).length;
  const sains = members.filter((m) => m.risk_score < 40).length;
  const avgScore =
    members.length > 0 ? Math.round(members.reduce((s, m) => s + m.risk_score, 0) / members.length) : 0;

  // Score par plateforme
  const platformScores = platforms
    .map((p) => {
      const access = accessRights.filter((a) => a.platform_id === p.id && a.level !== 'none');
      const adminCount = access.filter((a) => a.level === 'admin').length;
      const noMfa = !p.has_mfa && adminCount > 0;
      let score = 50;
      const factors: { label: string; delta: number }[] = [];
      if (adminCount > 3) {
        score += 30;
        factors.push({ label: `${adminCount} comptes Admin (max 3)`, delta: 30 });
      }
      if (noMfa) {
        score += 25;
        factors.push({ label: 'Admin sans MFA', delta: 25 });
      }
      if (adminCount <= 2 && p.has_mfa) {
        score -= 20;
        factors.push({ label: 'MFA activé', delta: -20 });
      }
      score = Math.max(0, Math.min(100, score));
      return { ...p, score, factors, adminCount, userCount: access.length };
    })
    .sort((a, b) => b.score - a.score);

  const critiquePlatforms = platformScores.filter((p) => p.score >= 70).length;

  const sortedMembers = [...members].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Score de risque</h1>
        <p className="text-sm text-gray-500">Analyse des risques en temps réel — Score calculé automatiquement</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Score moyen"
          value={avgScore}
          sub="Membres actifs"
          bg={avgScore >= 70 ? 'bg-red-50' : avgScore >= 40 ? 'bg-amber-50' : 'bg-green-50'}
          icon={BarChart2}
          iconColor={avgScore >= 70 ? 'text-red-500' : avgScore >= 40 ? 'text-amber-500' : 'text-green-500'}
        />
        <StatCard
          label="Membres critiques"
          value={critiques}
          sub="Score ≥ 70"
          bg="bg-red-50"
          icon={AlertTriangle}
          iconColor="text-red-500"
        />
        <StatCard
          label="À surveiller"
          value={aRisque}
          sub="Score 40–70"
          bg="bg-amber-50"
          icon={Activity}
          iconColor="text-amber-500"
        />
        <StatCard
          label="Profil sain"
          value={sains}
          sub="Score < 40"
          bg="bg-green-50"
          icon={Shield}
          iconColor="text-green-500"
        />
      </div>

      {/* Plateforme critique */}
      {critiquePlatforms > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {critiquePlatforms} plateforme{critiquePlatforms > 1 ? 's' : ''} à score critique
            </p>
            <p className="text-xs text-red-600">
              Vérifiez les droits Admin et l'activation du MFA sur ces plateformes.
            </p>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('membre')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            view === 'membre' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Par membre
          {critiques > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {critiques}
            </span>
          )}
        </button>
        <button
          onClick={() => setView('plateforme')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            view === 'plateforme' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Par plateforme
          {critiquePlatforms > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {critiquePlatforms}
            </span>
          )}
        </button>
      </div>

      {view === 'membre' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Membre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Équipe</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Facteurs principaux</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Aucun membre</p>
                      <p className="text-xs text-gray-400 mt-1">Ajoutez des membres pour voir les scores de risque</p>
                    </td>
                  </tr>
                ) : (
                  sortedMembers.map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                        m.risk_score >= 70 ? 'bg-red-50/30' : ''
                      }`}
                      onClick={() => navigate(`/membres/${m.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-xs font-semibold">
                            {m.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{m.full_name}</p>
                            {m.status !== 'actif' && (
                              <p className="text-[10px] text-amber-600 font-medium capitalize">{m.status}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{m.team}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 justify-center">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${m.risk_score}%`, backgroundColor: getRiskColor(m.risk_score) }}
                            />
                          </div>
                          <RiskBadge score={m.risk_score} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.risk_factors.slice(0, 3).map((f, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded-full truncate max-w-[180px] ${
                                f.delta > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                              }`}
                            >
                              {f.delta > 0 ? '+' : ''}{f.delta} {f.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Plateforme</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Score</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Utilisateurs</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Admin</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Facteurs</th>
                </tr>
              </thead>
              <tbody>
                {platformScores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Aucune plateforme</p>
                      <p className="text-xs text-gray-400 mt-1">Ajoutez des plateformes pour analyser les risques</p>
                    </td>
                  </tr>
                ) : (
                  platformScores.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        p.score >= 70 ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <PlatformIcon name={p.name} category={p.category} size={28} />
                          <div>
                            <p className="font-semibold text-gray-900">{p.name}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{p.environment}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 justify-center">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.score}%`, backgroundColor: getRiskColor(p.score) }}
                            />
                          </div>
                          <RiskBadge score={p.score} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{p.userCount}</td>
                      <td className={`px-4 py-3 text-center font-bold ${p.adminCount > 3 ? 'text-red-600' : 'text-gray-700'}`}>
                        {p.adminCount}
                        {p.adminCount > 3 && (
                          <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.factors.map((f, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded-full ${
                                f.delta > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                              }`}
                            >
                              {f.delta > 0 ? '+' : ''}{f.delta} {f.label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explication du calcul */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#534AB7]" />
          Formule de calcul du score de risque
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {[
            { delta: '+40', label: 'Date de départ passée, accès actifs', color: 'bg-red-50 text-red-700' },
            { delta: '+30', label: 'Admin sur plus de 3 plateformes', color: 'bg-red-50 text-red-700' },
            { delta: '+25', label: 'Revue dépassée de plus de 90 jours', color: 'bg-red-50 text-red-700' },
            { delta: '+20', label: 'Compte partagé avec droits Admin', color: 'bg-red-50 text-red-700' },
            { delta: '+15', label: 'Plateforme critique sans MFA', color: 'bg-red-50 text-red-700' },
            { delta: '-20', label: 'Toutes les revues sont à jour', color: 'bg-green-50 text-green-700' },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg ${item.color}`}
            >
              <span className="font-bold text-sm flex-shrink-0">{item.delta}</span>
              <span className="leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
