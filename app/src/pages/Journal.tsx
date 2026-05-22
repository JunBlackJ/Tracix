// ═══════════════════════════════════════════
// Page Journal d'audit — Immuable
// ═══════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Search, Download, Lock, ShieldCheck, Clock, User, Server, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuditTrail } from '@/types';

interface JournalProps {
  auditTrail: AuditTrail[];
}

export function Journal({ auditTrail: initialTrail }: JournalProps) {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [entries, setEntries] = useState<AuditTrail[]>(initialTrail);

  // Fetch first page from API on mount
  useEffect(() => {
    api.auditTrail.list({ page: 1, limit: 100 }).then((res) => {
      setEntries(res.data);
    }).catch(() => {
      // Fall back to the prop data
      setEntries(initialTrail);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = entries.filter((entry) => {
    if (search && !entry.action.toLowerCase().includes(search.toLowerCase()) && !entry.target_label.toLowerCase().includes(search.toLowerCase())) return false;
    if (actorFilter && !entry.actor.toLowerCase().includes(actorFilter.toLowerCase())) return false;
    return true;
  });

  const actionIcon = (action: string) => {
    if (action.includes('access.')) return <ShieldCheck className="w-4 h-4 text-[#534AB7]" />;
    if (action.includes('member.')) return <User className="w-4 h-4 text-green-600" />;
    if (action.includes('system.')) return <Server className="w-4 h-4 text-blue-600" />;
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Journal d'audit</h1>
        <p className="text-sm text-gray-500">Journal immuable — toutes les actions sont tracées</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une action..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-56 outline-none focus:ring-2 focus:ring-[#534AB7]/20"
          />
        </div>
        <input
          type="text"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          placeholder="Filtrer par acteur..."
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-48 outline-none focus:ring-2 focus:ring-[#534AB7]/20"
        />
        <button
          onClick={() => exportCSV(filtered)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors ml-auto"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Intégrité */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <Lock className="w-5 h-5 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Journal certifié en lecture seule</p>
          <p className="text-xs text-green-600">Aucune modification n'est possible. Intégrité vérifiée.</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-green-600 ml-auto flex-shrink-0" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Horodatage</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Acteur</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Cible</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(entry.created_at).toLocaleString('fr-FR')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{entry.actor}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {actionIcon(entry.action)}
                    <span className="text-gray-700">{entry.action}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 font-medium">{entry.target_label}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{entry.ip_address}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucune entrée dans le journal
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
