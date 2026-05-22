// ═══════════════════════════════════════════
// Page Systèmes — Inventaire
// ═══════════════════════════════════════════

import { useState } from 'react';
import {
  Search, Plus, AlertTriangle, Clock, X, Save, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { System, SystemStatus, Criticality } from '@/types';

interface SystemesProps {
  systems: System[];
  onSystemCreated?: (s: System) => void;
}

export function Systemes({ systems, onSystemCreated }: SystemesProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<System | null>(null);

  const filtered = systems.filter((s) =>
    !search || s.hostname.toLowerCase().includes(search.toLowerCase()) || s.system_id.toLowerCase().includes(search.toLowerCase())
  );

  const getCriticalityColor = (c: Criticality) => {
    switch (c) {
      case 'critique': return 'bg-red-100 text-red-700';
      case 'élevée': return 'bg-orange-100 text-orange-700';
      case 'normale': return 'bg-blue-100 text-blue-700';
      case 'faible': return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusColor = (s: SystemStatus) => {
    switch (s) {
      case 'actif': return 'bg-green-100 text-green-700';
      case 'maintenance': return 'bg-amber-100 text-amber-700';
      case 'inactif': return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Systèmes</h1>
            <p className="text-sm text-gray-500">{systems.length} systèmes inventoriés</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors w-fit"
          >
            <Plus className="w-4 h-4" />
            Nouveau système
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par hostname ou ID..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-72 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Hostname</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">OS</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">IP</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Criticité</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Dernier patch</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fin support</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const now = new Date();
                const patchDays = Math.floor((now.getTime() - new Date(s.last_patch_date).getTime()) / (86400000));
                const eolDays = Math.floor((new Date(s.end_of_support_date).getTime() - now.getTime()) / (86400000));
                const isPatchOld = patchDays > 90;
                const isEolSoon = eolDays > 0 && eolDays < 90;

                return (
                  <tr
                    key={s.id}
                    onClick={() => setEditTarget(s)}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isPatchOld ? 'bg-red-50/50' : isEolSoon ? 'bg-amber-50/50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.system_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.hostname}</td>
                    <td className="px-4 py-3 text-gray-600">{s.type}</td>
                    <td className="px-4 py-3 text-gray-600">{s.os_version}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.ip_address}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${getCriticalityColor(s.criticality)}`}>{s.criticality}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${getStatusColor(s.status)}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs flex items-center gap-1 ${isPatchOld ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {isPatchOld && <AlertTriangle className="w-3 h-3" />}
                        {s.last_patch_date ? new Date(s.last_patch_date).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs flex items-center gap-1 ${isEolSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                        {isEolSoon && <Clock className="w-3 h-3" />}
                        {s.end_of_support_date ? new Date(s.end_of_support_date).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.tech_responsible}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Aucun système trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <SystemFormModal
          onClose={() => setShowForm(false)}
          onSaved={(s) => {
            setShowForm(false);
            onSystemCreated?.(s);
          }}
        />
      )}
      {editTarget && (
        <SystemFormModal
          system={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(s) => {
            setEditTarget(null);
            onSystemCreated?.(s);
          }}
        />
      )}
    </>
  );
}

// ─── Modal création système ───

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
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Modifier le système' : 'Nouveau système'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ID Système *</label>
              <input {...inp('system_id')} className={cls('system_id')} placeholder="Ex: SRV-001" />
              {errors.system_id && <p className="text-[11px] text-red-500 mt-0.5">{errors.system_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hostname *</label>
              <input {...inp('hostname')} className={cls('hostname')} placeholder="Ex: srv-web-01" />
              {errors.hostname && <p className="text-[11px] text-red-500 mt-0.5">{errors.hostname}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
              <input {...inp('type')} className={cls('type')} placeholder="Ex: Serveur, Poste, VM…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Version OS</label>
              <input {...inp('os_version')} className={cls('os_version')} placeholder="Ex: Ubuntu 22.04" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse IP</label>
              <input {...inp('ip_address')} className={cls('ip_address')} placeholder="Ex: 192.168.1.10" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">VLAN</label>
              <input {...inp('vlan')} className={cls('vlan')} placeholder="Ex: VLAN-10" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Environnement</label>
              <select {...inp('environment')} className={cls('environment')}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="dev">Dev</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Criticité</label>
              <select {...inp('criticality')} className={cls('criticality')}>
                <option value="critique">Critique</option>
                <option value="élevée">Élevée</option>
                <option value="normale">Normale</option>
                <option value="faible">Faible</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Statut</label>
              <select {...inp('status')} className={cls('status')}>
                <option value="actif">Actif</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable technique</label>
              <input {...inp('tech_responsible')} className={cls('tech_responsible')} placeholder="Ex: Jean Martin" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Propriétaire</label>
              <input {...inp('owner')} className={cls('owner')} placeholder="Ex: DSI" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dernier patch</label>
              <input type="date" {...inp('last_patch_date')} className={cls('last_patch_date')} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fin de support</label>
              <input type="date" {...inp('end_of_support_date')} className={cls('end_of_support_date')} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              {...inp('notes')}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
              placeholder="Informations complémentaires…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? (isEdit ? 'Enregistrement…' : 'Création…') : (isEdit ? 'Enregistrer' : 'Créer le système')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
