import { useState } from 'react';
import { Bell, CheckCircle2, Shield, Server, Network, CreditCard, AlertTriangle, Info, X } from 'lucide-react';
import { SEVERITY_CONFIG } from '@/types';
import type { Alert, AlertType } from '@/types';

interface AlertesProps {
  onResolveAlert: (id: string) => void;
  onResolveAll: (ids: string[]) => void;
  alerts: Alert[];
}

const TYPE_LABELS: Record<AlertType, string> = {
  access_review_overdue: 'Revue dépassée',
  admin_count_high: "Trop d'Admin",
  member_offboarding: 'Offboarding',
  orphan_account: 'Compte orphelin',
  no_mfa_on_admin: 'MFA manquant',
  shared_account_admin: 'Compte partagé Admin',
  subscription_expiring: 'Renouvellement proche',
  subscription_expired: 'Abonnement expiré',
  system_end_of_support: 'Fin de support',
  system_not_patched: 'Patch manquant',
  flow_review_overdue: 'Revue flux dépassée',
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  habilitation: Shield,
  système: Server,
  réseau: Network,
  abonnement: CreditCard,
};

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

export function Alertes({ onResolveAlert, onResolveAll, alerts }: AlertesProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('unresolved');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const total = alerts.length;
  const critiques = alerts.filter((a) => a.severity === 'critical' && !a.is_resolved).length;
  const warnings = alerts.filter((a) => a.severity === 'warning' && !a.is_resolved).length;
  const infoCount = alerts.filter((a) => a.severity === 'info' && !a.is_resolved).length;
  const resolvedCount = alerts.filter((a) => a.is_resolved).length;
  const resolvedPct = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

  const filtered = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter === 'unresolved' && a.is_resolved) return false;
    if (statusFilter === 'resolved' && !a.is_resolved) return false;
    if (moduleFilter !== 'all' && a.source_module !== moduleFilter) return false;
    return true;
  });

  const unresolvedIds = filtered.filter((a) => !a.is_resolved).map((a) => a.id);

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alertes</h1>
          <p className="text-sm text-gray-500">
            {alerts.filter((a) => !a.is_resolved).length} alertes non résolues sur {total} au total
          </p>
        </div>
        {unresolvedIds.length > 0 && (
          <button
            onClick={() => onResolveAll(unresolvedIds)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors w-fit shadow-sm shadow-[#534AB7]/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            Tout résoudre ({unresolvedIds.length})
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Alertes critiques"
          value={critiques}
          sub="Non résolues"
          bg="bg-red-50"
          icon={AlertTriangle}
          iconColor="text-red-500"
        />
        <StatCard
          label="Avertissements"
          value={warnings}
          sub="Non résolus"
          bg="bg-amber-50"
          icon={Bell}
          iconColor="text-amber-500"
        />
        <StatCard
          label="Informations"
          value={infoCount}
          sub="Non résolues"
          bg="bg-blue-50"
          icon={Info}
          iconColor="text-blue-500"
        />
        <StatCard
          label="Taux de résolution"
          value={`${resolvedPct}%`}
          sub={`${resolvedCount} / ${total} traitées`}
          bg="bg-green-50"
          icon={CheckCircle2}
          iconColor="text-green-500"
        />
      </div>

      {/* Barre de progression globale */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Répartition par sévérité</p>
            <p className="text-xs text-gray-400">{total} alertes</p>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {critiques > 0 && (
              <div
                className="bg-red-500 rounded-l-full transition-all"
                style={{ width: `${(critiques / total) * 100}%` }}
                title={`${critiques} critique(s)`}
              />
            )}
            {warnings > 0 && (
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${(warnings / total) * 100}%` }}
                title={`${warnings} warning(s)`}
              />
            )}
            {infoCount > 0 && (
              <div
                className="bg-blue-400 transition-all"
                style={{ width: `${(infoCount / total) * 100}%` }}
                title={`${infoCount} info(s)`}
              />
            )}
            {resolvedCount > 0 && (
              <div
                className="bg-green-400 rounded-r-full transition-all"
                style={{ width: `${(resolvedCount / total) * 100}%` }}
                title={`${resolvedCount} résolue(s)`}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { color: 'bg-red-500', label: 'Critique' },
              { color: 'bg-amber-400', label: 'Avertissement' },
              { color: 'bg-blue-400', label: 'Info' },
              { color: 'bg-green-400', label: 'Résolues' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                <span className="text-[11px] text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
        >
          <option value="all">Toutes sévérités</option>
          <option value="critical">Critique</option>
          <option value="warning">Avertissement</option>
          <option value="info">Info</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
        >
          <option value="unresolved">Non résolues</option>
          <option value="resolved">Résolues</option>
          <option value="all">Toutes</option>
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
        >
          <option value="all">Tous modules</option>
          <option value="habilitation">Habilitations</option>
          <option value="système">Systèmes</option>
          <option value="réseau">Flux réseau</option>
          <option value="abonnement">Abonnements</option>
        </select>
        {(severityFilter !== 'all' || statusFilter !== 'unresolved' || moduleFilter !== 'all') && (
          <button
            onClick={() => { setSeverityFilter('all'); setStatusFilter('unresolved'); setModuleFilter('all'); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste des alertes */}
      <div className="space-y-2">
        {filtered.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          const ModIcon = MODULE_ICONS[alert.source_module] || Bell;
          const typeLabel = TYPE_LABELS[alert.type] || alert.type;

          return (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-4 transition-all hover:shadow-sm ${
                alert.is_resolved ? 'border-gray-200 opacity-60' : cfg.border
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>
                  <ModIcon className={`w-4 h-4 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {typeLabel}
                    </span>
                    <span className="text-[10px] text-gray-400 capitalize">{alert.source_module}</span>
                    {alert.is_resolved && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Résolu
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 mt-1.5 font-semibold">{alert.source_label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {new Date(alert.created_at).toLocaleString('fr-FR')}
                    {alert.is_resolved && alert.resolved_by && ` · Résolu par ${alert.resolved_by}`}
                  </p>
                </div>
                {!alert.is_resolved && (
                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="flex-shrink-0 text-xs text-[#534AB7] hover:text-[#3C3489] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#534AB7]/10 transition-colors border border-[#534AB7]/20"
                  >
                    Résoudre
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Aucune alerte</p>
            <p className="text-sm text-gray-400 mt-1">
              {statusFilter === 'unresolved'
                ? 'Toutes les alertes sont résolues. Excellent travail !'
                : 'Aucune alerte correspond aux filtres sélectionnés.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
