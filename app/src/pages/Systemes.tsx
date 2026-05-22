import { useState } from 'react';
import {
  Search, Plus, AlertTriangle, Clock, X, Save, Loader2, HardDrive,
  Server, ShieldAlert, CheckCircle2, Wrench, Filter,
} from 'lucide-react';
import { EmptyState, FilterEmpty } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { System, SystemStatus, Criticality } from '@/types';

interface SystemesProps {
  systems: System[];
  onSystemCreated?: (s: System) => void;
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

export function Systemes({ systems, onSystemCreated }: SystemesProps) {
  const [search, setSearch] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<System | null>(null);

  const now = new Date();

  const actifs = systems.filter((s) => s.status === 'actif').length;
  const patchOld = systems.filter((s) => {
    if (!s.last_patch_date) return false;
    return Math.floor((now.getTime() - new Date(s.last_patch_date).getTime()) / 86400000) > 90;
  }).length;
  const eolSoon = systems.filter((s) => {
    if (!s.end_of_support_date) return false;
    const days = Math.floor((new Date(s.end_of_support_date).getTime() - now.getTime()) / 86400000);
    return days >= 0 && days < 90;
  }).length;
  const critiques = systems.filter((s) => s.criticality === 'critique').length;

  const filtered = systems.filter((s) => {
    if (search && !s.hostname.toLowerCase().includes(search.toLowerCase()) && !s.system_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (criticalityFilter !== 'all' && s.criticality !== criticalityFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const getCriticalityColor = (c: Criticality) => {
    switch (c) {
      case 'critique': return 'bg-red-100 text-red-700 border-red-200';
      case 'élevée': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normale': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'faible': return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusColor = (s: SystemStatus) => {
    switch (s) {
      case 'actif': return 'bg-green-100 text-green-700';
      case 'maintenance': return 'bg-amber-100 text-amber-700';
      case 'inactif': return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusDot = (s: SystemStatus) => {
    switch (s) {
      case 'actif': return 'bg-green-500';
      case 'maintenance': return 'bg-amber-500';
      case 'inactif': return 'bg-gray-400';
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Systèmes</h1>
            <p className="text-sm text-gray-500">{systems.length} systèmes inventoriés</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors w-fit shadow-sm shadow-[#534AB7]/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau système
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Systèmes actifs"
            value={actifs}
            sub={`sur ${systems.length} total`}
            bg="bg-green-50"
            icon={CheckCircle2}
            iconColor="text-green-500"
          />
          <StatCard
            label="Patches anciens"
            value={patchOld}
            sub="> 90 jours sans patch"
            bg={patchOld > 0 ? 'bg-red-50' : 'bg-gray-50'}
            icon={ShieldAlert}
            iconColor={patchOld > 0 ? 'text-red-500' : 'text-gray-400'}
          />
          <StatCard
            label="Fin de support proche"
            value={eolSoon}
            sub="Dans les 90 prochains jours"
            bg={eolSoon > 0 ? 'bg-amber-50' : 'bg-gray-50'}
            icon={Clock}
            iconColor={eolSoon > 0 ? 'text-amber-500' : 'text-gray-400'}
          />
          <StatCard
            label="Critique"
            value={critiques}
            sub="Systèmes critiques"
            bg={critiques > 0 ? 'bg-red-50' : 'bg-gray-50'}
            icon={AlertTriangle}
            iconColor={critiques > 0 ? 'text-red-500' : 'text-gray-400'}
          />
        </div>

        {/* Alertes actives */}
        {(patchOld > 0 || eolSoon > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {patchOld > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {patchOld} système{patchOld > 1 ? 's' : ''} avec patch &gt; 90 jours
                  </p>
                  <p className="text-xs text-red-600">Planifiez une mise à jour corrective.</p>
                </div>
              </div>
            )}
            {eolSoon > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {eolSoon} système{eolSoon > 1 ? 's' : ''} en fin de support imminente
                  </p>
                  <p className="text-xs text-amber-600">Planifiez la migration ou le renouvellement.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hostname ou ID..."
              className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 w-56 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
            />
          </div>
          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-[#534AB7]/20"
          >
            <option value="all">Toutes criticités</option>
            <option value="critique">Critique</option>
            <option value="élevée">Élevée</option>
            <option value="normale">Normale</option>
            <option value="faible">Faible</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-[#534AB7]/20"
          >
            <option value="all">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactif">Inactif</option>
          </select>
          {(search || criticalityFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setCriticalityFilter('all'); setStatusFilter('all'); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
          )}
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Système</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type / OS</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">IP</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Criticité</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Dernier patch</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Fin support</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {systems.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={HardDrive}
                        title="Aucun système"
                        description="Inventoriez vos serveurs, VMs et équipements pour suivre les patches et dates de fin de support."
                        action={{ label: '+ Nouveau système', onClick: () => setShowForm(true) }}
                        hint="Des alertes automatiques vous préviendront avant la fin de support de chaque OS."
                      />
                    </td>
                  </tr>
                )}
                {systems.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <FilterEmpty onReset={() => { setSearch(''); setCriticalityFilter('all'); setStatusFilter('all'); }} />
                    </td>
                  </tr>
                )}
                {filtered.map((s) => {
                  const patchDays = s.last_patch_date
                    ? Math.floor((now.getTime() - new Date(s.last_patch_date).getTime()) / 86400000)
                    : null;
                  const eolDays = s.end_of_support_date
                    ? Math.floor((new Date(s.end_of_support_date).getTime() - now.getTime()) / 86400000)
                    : null;
                  const isPatchOld = patchDays !== null && patchDays > 90;
                  const isEolSoon = eolDays !== null && eolDays >= 0 && eolDays < 90;
                  const isEolPassed = eolDays !== null && eolDays < 0;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setEditTarget(s)}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                        isPatchOld || isEolPassed ? 'bg-red-50/20' : isEolSoon ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Server className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{s.hostname}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{s.system_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{s.type}</p>
                        <p className="text-[11px] text-gray-400">{s.os_version}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.ip_address}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${getCriticalityColor(s.criticality)}`}>
                          {s.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium ${getStatusColor(s.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(s.status)}`} />
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.last_patch_date ? (
                          <span className={`text-xs flex items-center gap-1 ${isPatchOld ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            {isPatchOld && <AlertTriangle className="w-3 h-3" />}
                            {new Date(s.last_patch_date).toLocaleDateString('fr-FR')}
                            {isPatchOld && <span className="text-[10px]">({patchDays}j)</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.end_of_support_date ? (
                          <span
                            className={`text-xs flex items-center gap-1 ${
                              isEolPassed
                                ? 'text-red-600 font-semibold'
                                : isEolSoon
                                ? 'text-amber-600 font-semibold'
                                : 'text-gray-500'
                            }`}
                          >
                            {(isEolSoon || isEolPassed) && <Clock className="w-3 h-3" />}
                            {new Date(s.end_of_support_date).toLocaleDateString('fr-FR')}
                            {isEolSoon && eolDays !== null && (
                              <span className="text-[10px]">(J-{eolDays})</span>
                            )}
                            {isEolPassed && <span className="text-[10px]">(expiré)</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{s.tech_responsible}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <SystemFormModal
          onClose={() => setShowForm(false)}
          onSaved={(s) => { setShowForm(false); onSystemCreated?.(s); }}
        />
      )}
      {editTarget && (
        <SystemFormModal
          system={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(s) => { setEditTarget(null); onSystemCreated?.(s); }}
        />
      )}
    </>
  );
}

interface SystemFormModalProps {
  system?: System;
  onClose: () => void;
  onSaved: (s: System) => void;
}

function SystemFormModal({ system, onClose, onSaved }: SystemFormModalProps) {
  const isEdit = !!system;
  const [form, setForm] = useState({
    system_id: system?.system_id ?? '',
    hostname: system?.hostname ?? '',
    type: system?.type ?? '',
    environment: (system?.environment ?? 'production') as 'production' | 'staging' | 'dev',
    os_version: system?.os_version ?? '',
    ip_address: system?.ip_address ?? '',
    vlan: system?.vlan ?? '',
    location: system?.location ?? '',
    role_usage: system?.role_usage ?? '',
    owner: system?.owner ?? '',
    tech_responsible: system?.tech_responsible ?? '',
    criticality: (system?.criticality ?? 'normale') as Criticality,
    status: (system?.status ?? 'actif') as SystemStatus,
    deployment_date: system?.deployment_date ?? '',
    end_of_support_date: system?.end_of_support_date ?? '',
    backup_policy: system?.backup_policy ?? '',
    last_patch_date: system?.last_patch_date ?? '',
    notes: system?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validate = () => {
    const e: Partial<Record<string, string>> = {};
    if (!form.system_id.trim()) e.system_id = 'Requis';
    if (!form.hostname.trim()) e.hostname = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.systems.update(system!.id, form)
        : await api.systems.create(form);
      toast.success(isEdit ? 'Système mis à jour' : 'Système créé avec succès');
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const inp = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const cls = (key: string) =>
    `w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#534AB7]/10 flex items-center justify-center">
              <Server className="w-4 h-4 text-[#534AB7]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Modifier le système' : 'Nouveau système'}</h2>
              <p className="text-xs text-gray-400">{isEdit ? system!.hostname : 'Renseignez les informations du système'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Identification */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Identification</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">ID Système *</label>
                <input {...inp('system_id')} className={cls('system_id')} placeholder="Ex: SRV-001" />
                {errors.system_id && <p className="text-[11px] text-red-500 mt-0.5">{errors.system_id}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Hostname *</label>
                <input {...inp('hostname')} className={cls('hostname')} placeholder="Ex: srv-web-01" />
                {errors.hostname && <p className="text-[11px] text-red-500 mt-0.5">{errors.hostname}</p>}
              </div>
            </div>
          </div>

          {/* Technique */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Informations techniques</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Type</label>
                <input {...inp('type')} className={cls('type')} placeholder="Ex: Serveur, Poste, VM…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Version OS</label>
                <input {...inp('os_version')} className={cls('os_version')} placeholder="Ex: Ubuntu 22.04" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Adresse IP</label>
                <input {...inp('ip_address')} className={cls('ip_address')} placeholder="Ex: 192.168.1.10" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">VLAN</label>
                <input {...inp('vlan')} className={cls('vlan')} placeholder="Ex: VLAN-10" />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Classification</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Environnement</label>
                <select {...inp('environment')} className={cls('environment')}>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="dev">Dev</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Criticité</label>
                <select {...inp('criticality')} className={cls('criticality')}>
                  <option value="critique">Critique</option>
                  <option value="élevée">Élevée</option>
                  <option value="normale">Normale</option>
                  <option value="faible">Faible</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Statut</label>
                <select {...inp('status')} className={cls('status')}>
                  <option value="actif">Actif</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
            </div>
          </div>

          {/* Responsabilité */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Responsabilité</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Responsable technique</label>
                <input {...inp('tech_responsible')} className={cls('tech_responsible')} placeholder="Ex: Jean Martin" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Propriétaire</label>
                <input {...inp('owner')} className={cls('owner')} placeholder="Ex: DSI" />
              </div>
            </div>
          </div>

          {/* Maintenance */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Maintenance</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Dernier patch</label>
                <input type="date" {...inp('last_patch_date')} className={cls('last_patch_date')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fin de support</label>
                <input type="date" {...inp('end_of_support_date')} className={cls('end_of_support_date')} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea
              {...inp('notes')}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
              placeholder="Informations complémentaires…"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-lg text-sm font-semibold hover:bg-[#3C3489] transition-colors disabled:opacity-60 shadow-sm shadow-[#534AB7]/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? (isEdit ? 'Enregistrement…' : 'Création…') : isEdit ? 'Enregistrer' : 'Créer le système'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
