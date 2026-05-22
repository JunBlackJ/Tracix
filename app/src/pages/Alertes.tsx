// ═══════════════════════════════════════════
// Page Alertes
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Bell, CheckCircle2, Shield, Server, Network, CreditCard } from 'lucide-react';
import { SEVERITY_CONFIG } from '@/types';
import type { Alert, AlertType } from '@/types';

interface AlertesProps {
  onResolveAlert: (id: string) => void;
  onResolveAll: (ids: string[]) => void;
  alerts: Alert[];
}

const TYPE_LABELS: Record<AlertType, string> = {
  access_review_overdue: 'Revue dépassée',
  admin_count_high: 'Trop d\'Admin',
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

export function Alertes({ onResolveAlert, onResolveAll, alerts }: AlertesProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('unresolved');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const filtered = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter === 'unresolved' && a.is_resolved) return false;
    if (statusFilter === 'resolved' && !a.is_resolved) return false;
    if (moduleFilter !== 'all' && a.source_module !== moduleFilter) return false;
    return true;
  });

  const unresolvedIds = filtered.filter((a) => !a.is_resolved).map((a) => a.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alertes</h1>
          <p className="text-sm text-gray-500">{alerts.filter((a) => !a.is_resolved).length} alertes non résolues</p>
        </div>
        {unresolvedIds.length > 0 && (
          <button
            onClick={() => onResolveAll(unresolvedIds)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors w-fit"
          >
            <CheckCircle2 className="w-4 h-4" />
            Tout résoudre ({unresolvedIds.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none">
          <option value="all">Toutes sévérités</option>
          <option value="critical">Critique</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none">
          <option value="unresolved">Non résolues</option>
          <option value="resolved">Résolues</option>
          <option value="all">Toutes</option>
        </select>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none">
          <option value="all">Tous modules</option>
          <option value="habilitation">Habilitations</option>
          <option value="système">Systèmes</option>
          <option value="réseau">Flux réseau</option>
          <option value="abonnement">Abonnements</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          const ModIcon = MODULE_ICONS[alert.source_module] || Bell;
          const typeLabel = TYPE_LABELS[alert.type] || alert.type;

          return (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-4 transition-all hover:shadow-sm ${alert.is_resolved ? 'border-gray-200 opacity-60' : cfg.border}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>
                  <ModIcon className={`w-4 h-4 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{typeLabel}</span>
                    <span className="text-[10px] text-gray-400">{alert.source_module}</span>
                    {alert.is_resolved && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Résolu
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 mt-1.5 font-medium">{alert.source_label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{alert.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {new Date(alert.created_at).toLocaleString('fr-FR')}
                    {alert.is_resolved && alert.resolved_by && ` · Résolu par ${alert.resolved_by}`}
                  </p>
                </div>
                {!alert.is_resolved && (
                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="text-xs text-[#534AB7] hover:underline flex-shrink-0 font-medium"
                  >
                    Résoudre
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500">Aucune alerte correspondant aux filtres</p>
          </div>
        )}
      </div>
    </div>
  );
}
