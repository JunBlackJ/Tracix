// ═══════════════════════════════════════════
// Page Score de risque
// ═══════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ShieldCheck, TrendingUp, ChevronRight } from 'lucide-react';
import { getRiskColor } from '@/types';
import type { Member, Platform, AccessRight } from '@/types';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { PlatformIcon } from '@/components/ui/PlatformIcon';

interface ScoreRisqueProps {
  members: Member[];
  platforms: Platform[];
  accessRights: AccessRight[];
}

export function ScoreRisque({ members, platforms, accessRights }: ScoreRisqueProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<'membre' | 'plateforme'>('membre');

  // Score par plateforme
  const platformScores = platforms.map((p) => {
    const access = accessRights.filter((a) => a.platform_id === p.id && a.level !== 'none');
    const adminCount = access.filter((a) => a.level === 'admin').length;
    const noMfa = !p.has_mfa && adminCount > 0;
    let score = 50;
    const factors: { label: string; delta: number }[] = [];
    if (adminCount > 3) { score += 30; factors.push({ label: `${adminCount} comptes Admin (max 3)`, delta: 30 }); }
    if (noMfa) { score += 25; factors.push({ label: 'Admin sans MFA', delta: 25 }); }
    if (adminCount <= 2 && p.has_mfa) { score -= 20; factors.push({ label: 'MFA activé', delta: -20 }); }
    score = Math.max(0, Math.min(100, score));
    return { ...p, score, factors, adminCount, userCount: access.length };
  }).sort((a, b) => a.score - b.score);

  const sortedMembers = [...members].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Score de risque</h1>
        <p className="text-sm text-gray-500 mt-0.5">Analyse des risques en temps réel</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('membre')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'membre' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          <Users className="w-4 h-4" />
          Par membre
        </button>
        <button
          onClick={() => setView('plateforme')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'plateforme' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          Par plateforme
        </button>
      </div>

      {view === 'membre' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Membre</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Équipe</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Score</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Facteurs principaux</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/membres/${m.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-xs font-medium">
                        {m.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{m.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.team}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-28 h-2.5 bg-gray-100 rounded-full overflow-hidden">
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
                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
              {platformScores.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon name={p.name} category={p.category} size={28} />
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-28 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.score}%`, backgroundColor: getRiskColor(p.score) }} />
                      </div>
                      <RiskBadge score={p.score} size="sm" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.userCount}</td>
                  <td className={`px-4 py-3 text-center font-bold ${p.adminCount > 3 ? 'text-red-600' : 'text-gray-700'}`}>{p.adminCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.factors.map((f, i) => (
                        <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${f.delta > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {f.delta > 0 ? '+' : ''}{f.delta} {f.label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Explication du calcul */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Formule de calcul du score
        </h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
            <span className="text-red-600 font-bold">+30</span>
            <span>Admin sur plus de 3 plateformes</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
            <span className="text-red-600 font-bold">+25</span>
            <span>Revue dépassée de plus de 90 jours</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
            <span className="text-red-600 font-bold">+40</span>
            <span>Date de départ passée, accès actifs</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
            <span className="text-red-600 font-bold">+20</span>
            <span>Compte partagé avec droits Admin</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
            <span className="text-red-600 font-bold">+15</span>
            <span>Plateforme critique sans MFA</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
            <span className="text-green-600 font-bold">-20</span>
            <span>Toutes les revues sont à jour</span>
          </div>
        </div>
      </div>
    </div>
  );
}
