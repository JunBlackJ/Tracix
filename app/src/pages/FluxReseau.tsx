// ═══════════════════════════════════════════
// Page Flux Réseau
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Search, Plus, CheckCircle2, XCircle, AlertCircle, Clock, X, Save, Loader2, Network } from 'lucide-react';
import { EmptyState, FilterEmpty } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { NetworkFlow, FlowDirection, FlowStatus } from '@/types';

interface FluxReseauProps {
  networkFlows: NetworkFlow[];
  onFlowCreated?: (f: NetworkFlow) => void;
}

export function FluxReseau({ networkFlows, onFlowCreated }: FluxReseauProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const filtered = networkFlows.filter((f) => {
    if (search && !f.flow_id.toLowerCase().includes(search.toLowerCase()) && !f.source_host.includes(search)) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (directionFilter !== 'all' && f.direction !== directionFilter) return false;
    return true;
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'autorisé': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'bloqué': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'conditionnel': return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Flux réseau</h1>
          <p className="text-sm text-gray-500">{networkFlows.length} flux enregistrés</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors w-fit"
        >
          <Plus className="w-4 h-4" />
          Nouveau flux
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-56 focus:ring-2 focus:ring-[#534AB7]/20 outline-none"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none">
          <option value="all">Tous les statuts</option>
          <option value="autorisé">Autorisé</option>
          <option value="bloqué">Bloqué</option>
          <option value="conditionnel">Conditionnel</option>
        </select>
        <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none">
          <option value="all">Toutes directions</option>
          <option value="entrant">Entrant</option>
          <option value="sortant">Sortant</option>
          <option value="bidirectionnel">Bidirectionnel</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Source</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Destination</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Port</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Protocole</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Service</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Direction</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Règle FW</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Responsable</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Revue</th>
            </tr>
          </thead>
          <tbody>
            {networkFlows.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <EmptyState
                    icon={Network}
                    title="Aucun flux réseau"
                    description="Documentez les flux autorisés entre vos systèmes pour faciliter les audits et revues de sécurité."
                    action={{ label: '+ Nouveau flux', onClick: () => setShowForm(true) }}
                    hint="Importez votre matrice de flux existante via le module Import IA."
                  />
                </td>
              </tr>
            )}
            {networkFlows.length > 0 && filtered.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <FilterEmpty onReset={() => { setSearch(''); setStatusFilter('all'); setDirectionFilter('all'); }} />
                </td>
              </tr>
            )}
            {filtered.map((f) => {
              const reviewDays = Math.floor((new Date().getTime() - new Date(f.last_review_date).getTime()) / 86400000);
              return (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{f.flow_id}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{f.source_host}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{f.destination_host}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-600">{f.port}</td>
                  <td className="px-4 py-3 text-gray-600">{f.protocol}</td>
                  <td className="px-4 py-3 text-gray-600">{f.service}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{f.direction}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {statusIcon(f.status)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.firewall_rule}</td>
                  <td className="px-4 py-3 text-gray-600">{f.responsible}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs flex items-center gap-1 ${reviewDays > 180 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {reviewDays > 180 && <Clock className="w-3 h-3" />}
                      {new Date(f.last_review_date).toLocaleDateString('fr-FR')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {showForm && (
      <FluxFormModal
        onClose={() => setShowForm(false)}
        onSaved={(f) => { setShowForm(false); onFlowCreated?.(f); }}
      />
    )}
    </>
  );
}

interface FluxFormModalProps {
  onClose: () => void;
  onSaved: (f: NetworkFlow) => void;
}

function FluxFormModal({ onClose, onSaved }: FluxFormModalProps) {
  const [form, setForm] = useState({
    flow_id: '',
    source_host: '',
    source_zone: '',
    destination_host: '',
    destination_zone: '',
    port: '',
    protocol: '',
    service: '',
    direction: 'entrant' as FlowDirection,
    status: 'autorisé' as FlowStatus,
    firewall_rule: '',
    justification: '',
    responsible: '',
    last_review_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validate = () => {
    const e: Partial<Record<string, string>> = {};
    if (!form.flow_id.trim()) e.flow_id = 'Requis';
    if (!form.source_host.trim()) e.source_host = 'Requis';
    if (!form.destination_host.trim()) e.destination_host = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await api.networkFlows.create(form);
      toast.success('Flux créé avec succès');
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création');
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Nouveau flux réseau</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ID Flux *</label>
              <input {...inp('flow_id')} className={cls('flow_id')} placeholder="Ex: FLX-001" />
              {errors.flow_id && <p className="text-[11px] text-red-500 mt-0.5">{errors.flow_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Protocole</label>
              <input {...inp('protocol')} className={cls('protocol')} placeholder="Ex: TCP, UDP…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Source *</label>
              <input {...inp('source_host')} className={cls('source_host')} placeholder="Ex: 192.168.1.10" />
              {errors.source_host && <p className="text-[11px] text-red-500 mt-0.5">{errors.source_host}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zone source</label>
              <input {...inp('source_zone')} className={cls('source_zone')} placeholder="Ex: LAN, DMZ…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Destination *</label>
              <input {...inp('destination_host')} className={cls('destination_host')} placeholder="Ex: 10.0.0.5" />
              {errors.destination_host && <p className="text-[11px] text-red-500 mt-0.5">{errors.destination_host}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zone destination</label>
              <input {...inp('destination_zone')} className={cls('destination_zone')} placeholder="Ex: WAN, Prod…" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Port</label>
              <input {...inp('port')} className={cls('port')} placeholder="Ex: 443, 80…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Direction</label>
              <select {...inp('direction')} className={cls('direction')}>
                <option value="entrant">Entrant</option>
                <option value="sortant">Sortant</option>
                <option value="bidirectionnel">Bidirectionnel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Statut</label>
              <select {...inp('status')} className={cls('status')}>
                <option value="autorisé">Autorisé</option>
                <option value="bloqué">Bloqué</option>
                <option value="conditionnel">Conditionnel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Service</label>
              <input {...inp('service')} className={cls('service')} placeholder="Ex: HTTPS, SSH…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Règle firewall</label>
              <input {...inp('firewall_rule')} className={cls('firewall_rule')} placeholder="Ex: FW-RULE-42" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
            <input {...inp('responsible')} className={cls('responsible')} placeholder="Ex: Jean Martin" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Justification</label>
            <textarea {...inp('justification')} rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
              placeholder="Raison du flux…" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Création…' : 'Créer le flux'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
