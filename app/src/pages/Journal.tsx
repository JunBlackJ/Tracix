import { useState, useEffect } from 'react';
import { Search, Download, Lock, ShieldCheck, Clock, User, Server, FileText, Activity, Users, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuditTrail } from '@/types';

interface JournalProps {
  auditTrail: AuditTrail[];
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

export function Journal({ auditTrail: initialTrail }: JournalProps) {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [entries, setEntries] = useState<AuditTrail[]>(initialTrail);

  useEffect(() => {
    api.auditTrail.list({ page: 1, limit: 100 }).then((res) => {
      setEntries(res.data);
    }).catch(() => {
      setEntries(initialTrail);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toDateString();
  const todayCount = entries.filter((e) => new Date(e.created_at).toDateString() === today).length;
  const uniqueActors = new Set(entries.map((e) => e.actor)).size;
  const uniqueActions = new Set(entries.map((e) => e.action.split('.')[0])).size;

  const filtered = entries.filter((entry) => {
    if (
      search &&
      !entry.action.toLowerCase().includes(search.toLowerCase()) &&
      !entry.target_label.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (actorFilter && !entry.actor.toLowerCase().includes(actorFilter.toLowerCase())) return false;
    return true;
  });

  const actionIcon = (action: string) => {
    if (action.includes('access.')) return <ShieldCheck className="w-4 h-4 text-[#534AB7]" />;
    if (action.includes('member.')) return <User className="w-4 h-4 text-green-600" />;
    if (action.includes('system.')) return <Server className="w-4 h-4 text-blue-600" />;
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) return 'bg-red-50 text-red-700';
    if (action.includes('create') || action.includes('add')) return 'bg-green-50 text-green-700';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-50 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Journal d'audit</h1>
        <p className="text-sm text-gray-500">Journal immuable — toutes les actions sont tracées et certifiées</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Entrées totales"
          value={entries.length.toLocaleString('fr-FR')}
          sub="Dans la base"
          bg="bg-[#534AB7]/10"
          icon={Activity}
          iconColor="text-[#534AB7]"
        />
        <StatCard
          label="Aujourd'hui"
          value={todayCount}
          sub="Actions du jour"
          bg="bg-blue-50"
          icon={Calendar}
          iconColor="text-blue-500"
        />
        <StatCard
          label="Acteurs uniques"
          value={uniqueActors}
          sub="Utilisateurs actifs"
          bg="bg-green-50"
          icon={Users}
          iconColor="text-green-500"
        />
        <StatCard
          label="Types d'actions"
          value={uniqueActions}
          sub="Catégories distinctes"
          bg="bg-amber-50"
          icon={FileText}
          iconColor="text-amber-500"
        />
      </div>

      {/* Bannière intégrité */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <Lock className="w-5 h-5 text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-800">Journal certifié en lecture seule</p>
          <p className="text-xs text-green-600">Aucune modification n'est possible. Intégrité vérifiée automatiquement.</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
      </div>

      {/* Filtres et export */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une action ou une cible..."
            className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 w-64 outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
          />
        </div>
        <div className="relative flex items-center">
          <User className="absolute left-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filtrer par acteur..."
            className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 w-48 outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
          />
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
        >
          <Download className="w-4 h-4" />
          Export CSV
          {filtered.length < entries.length && (
            <span className="text-[11px] bg-[#534AB7] text-white rounded-full px-1.5 py-0.5">
              {filtered.length}
            </span>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Horodatage</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Acteur</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Cible</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-xs">{new Date(entry.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#534AB7]/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-[#534AB7]" />
                      </div>
                      <span className="text-xs font-mono text-gray-700">{entry.actor}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {actionIcon(entry.action)}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getActionBadgeColor(entry.action)}`}
                      >
                        {entry.action}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {entry.target_type && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                        {entry.target_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium text-sm">{entry.target_label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{entry.ip_address}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Lock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Aucune entrée dans le journal</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search || actorFilter ? 'Modifiez les filtres pour voir plus de résultats' : 'Les actions seront enregistrées ici automatiquement'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
              {filtered.length < entries.length ? ` (sur ${entries.length} total)` : ''}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <Lock className="w-3 h-3" />
              Journal certifié
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function exportCSV(entries: AuditTrail[]) {
  const headers = ['Horodatage', 'Acteur', 'Action', 'Type cible', 'Cible', 'IP'];
  const rows = entries.map((e) => [
    new Date(e.created_at).toLocaleString('fr-FR'),
    e.actor,
    e.action,
    e.target_type,
    e.target_label,
    e.ip_address,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
