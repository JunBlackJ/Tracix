// ═══════════════════════════════════════════
// Page Plateformes
// ═══════════════════════════════════════════

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, ArrowLeft, ShieldCheck, Eye, EyeOff, Globe, Users,
  AlertTriangle, CheckCircle2, XCircle, X, Save, Loader2, Download, Server,
} from 'lucide-react';
import { EmptyState, FilterEmpty } from '@/components/ui/EmptyState';
import * as XLSX from 'xlsx';
import { ACCESS_LEVEL_CONFIG, SEVERITY_CONFIG } from '@/types';
import type { Platform, Member, Alert, AccessRight } from '@/types';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface PlateformesProps {
  platforms: Platform[];
  members: Member[];
  alerts: Alert[];
  accessRights: AccessRight[];
  onPlatformCreated?: (p: Platform) => void;
}

export function Plateformes({ platforms, members, alerts, accessRights, onPlatformCreated }: PlateformesProps) {
  const { id } = useParams<{ id: string }>();
  const [showForm, setShowForm] = useState(false);

  if (id) return <PlateformeDetail platformId={id} platforms={platforms} members={members} alerts={alerts} accessRights={accessRights} />;

  return (
    <>
      <PlateformesList
        platforms={platforms}
        members={members}
        alerts={alerts}
        accessRights={accessRights}
        onNew={() => setShowForm(true)}
      />
      {showForm && (
        <PlatformFormModal
          onClose={() => setShowForm(false)}
          onSaved={(p) => {
            setShowForm(false);
            onPlatformCreated?.(p);
          }}
        />
      )}
    </>
  );
}

function PlateformesList({ platforms, members: _members, alerts, accessRights, onNew }: PlateformesProps & { onNew: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const getPlatformAccess = (platformId: string) =>
    accessRights.filter((a) => a.platform_id === platformId);

  const filtered = platforms.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plateformes</h1>
          <p className="text-sm text-gray-500">{platforms.length} plateformes surveillées</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const ws = XLSX.utils.json_to_sheet(platforms.map((p) => ({
                Nom: p.name, Catégorie: p.category, URL: p.url,
                Environnement: p.environment, MFA: p.has_mfa ? 'Oui' : 'Non',
                Responsable: p.responsible, Statut: p.status,
              })));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Plateformes');
              XLSX.writeFile(wb, 'plateformes.xlsx');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle plateforme
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none"
        />
      </div>
      {platforms.length === 0 && (
        <EmptyState
          icon={Server}
          title="Aucune plateforme"
          description="Référencez vos outils SaaS, applications internes et systèmes pour commencer à gérer les accès."
          action={{ label: '+ Nouvelle plateforme', onClick: onNew }}
          hint="Conseil : importez votre inventaire via le module Import IA."
        />
      )}
      {platforms.length > 0 && filtered.length === 0 && (
        <FilterEmpty onReset={() => setSearch('')} />
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const access = getPlatformAccess(p.id);
          const adminCount = access.filter((a) => a.level === 'admin').length;
          const totalUsers = access.filter((a) => a.level !== 'none').length;
          const platformAlerts = alerts.filter((a) => a.source_id === p.id && !a.is_resolved);

          return (
            <div
              key={p.id}
              onClick={() => navigate(`/plateformes/${p.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-[#534AB7]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <PlatformIcon name={p.name} category={p.category} size={36} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-400">{p.category} · {p.access_type}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {totalUsers} utilisateurs</span>
                <span className={`flex items-center gap-1 font-medium ${adminCount > 3 ? 'text-red-600' : ''}`}>
                  <ShieldCheck className="w-3.5 h-3.5" /> {adminCount} Admin
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.has_mfa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {p.has_mfa ? 'MFA activé' : 'Pas de MFA'}
                </span>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.environment}</span>
                {platformAlerts.length > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {platformAlerts.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PlateformeDetailProps {
  platformId: string;
  platforms: Platform[];
  members: Member[];
  alerts: Alert[];
  accessRights: AccessRight[];
}

function PlateformeDetail({ platformId, platforms, members, alerts, accessRights }: PlateformeDetailProps) {
  const navigate = useNavigate();
  const [showUrl, setShowUrl] = useState(false);
  const platform = platforms.find((p) => p.id === platformId);
  if (!platform) return <div>Plateforme non trouvée</div>;

  const access = accessRights.filter((a) => a.platform_id === platformId);
  const platformAlerts = alerts.filter((a) => a.source_id === platformId && !a.is_resolved);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/plateformes')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <PlatformIcon name={platform.name} category={platform.category} size={44} />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{platform.name}</h1>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${platform.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {platform.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{platform.category} · {platform.access_type} · {platform.environment}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">URL</p>
            <div className="flex items-center gap-2 mt-1">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 font-mono">
                {showUrl ? platform.url : '••••••••••••••••'}
              </span>
              <button onClick={() => setShowUrl(!showUrl)} className="text-[#534AB7] hover:underline">
                {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">Authentification</p>
            <p className="text-sm text-gray-700 mt-1">{platform.auth_method}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">MFA</p>
            <p className={`text-sm mt-1 flex items-center gap-1 ${platform.has_mfa ? 'text-green-600' : 'text-red-600'}`}>
              {platform.has_mfa ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {platform.has_mfa ? 'Activé' : 'Non activé'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Responsable</p>
            <p className="text-sm text-gray-700 mt-1">{platform.responsible}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">SLA</p>
            <p className="text-sm text-gray-700 mt-1">{platform.sla}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Population cible</p>
            <p className="text-sm text-gray-700 mt-1">{platform.target_population}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Dernière vérification</p>
            <p className="text-sm text-gray-700 mt-1">{new Date(platform.last_check_date).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Qui a accès ? ({access.filter((a) => a.level !== 'none').length} utilisateurs)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-600">Membre</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Niveau</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Accordé le</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Dernière revue</th>
            </tr>
          </thead>
          <tbody>
            {access.filter((a) => a.level !== 'none').map((a) => {
              const member = members.find((m) => m.id === a.member_id);
              const cfg = ACCESS_LEVEL_CONFIG[a.level];
              return (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#534AB7] flex items-center justify-center text-white text-[10px] font-medium">
                        {member?.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{member?.full_name || '?'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{new Date(a.granted_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2.5 text-gray-500">{new Date(a.last_review_date).toLocaleDateString('fr-FR')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {platformAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alertes ({platformAlerts.length})
          </h3>
          <div className="space-y-2">
            {platformAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <div key={alert.id} className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <p className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</p>
                  <p className="text-xs text-gray-700 mt-1">{alert.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal création plateforme ───

interface PlatformFormModalProps {
  onClose: () => void;
  onSaved: (p: Platform) => void;
}

function PlatformFormModal({ onClose, onSaved }: PlatformFormModalProps) {
  const [form, setForm] = useState({
    name: '',
    category: '',
    access_type: '',
    url: '',
    auth_method: '',
    has_mfa: false,
    environment: 'production' as 'production' | 'staging' | 'dev',
    responsible: '',
    target_population: '',
    sla: '',
    status: 'actif' as 'actif' | 'inactif' | 'déprécié',
    last_check_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validate = () => {
    const e: Partial<Record<string, string>> = {};
    if (!form.name.trim()) e.name = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await api.platforms.create(form);
      toast.success('Plateforme créée avec succès');
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
          <h2 className="text-lg font-bold text-gray-900">Nouvelle plateforme</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nom *</label>
            <input {...inp('name')} className={cls('name')} placeholder="Ex: GitHub, Notion, AWS…" />
            {errors.name && <p className="text-[11px] text-red-500 mt-0.5">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
              <input {...inp('category')} className={cls('category')} placeholder="Ex: DevOps, Cloud, SaaS…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type d'accès</label>
              <input {...inp('access_type')} className={cls('access_type')} placeholder="Ex: Web, API, SSH…" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">URL</label>
            <input {...inp('url')} className={cls('url')} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Méthode d'auth</label>
              <input {...inp('auth_method')} className={cls('auth_method')} placeholder="Ex: SSO, Login/mdp…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
              <input {...inp('responsible')} className={cls('responsible')} placeholder="Ex: Jean Martin" />
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Statut</label>
              <select {...inp('status')} className={cls('status')}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="déprécié">Déprécié</option>
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_mfa}
                  onChange={(e) => setForm((f) => ({ ...f, has_mfa: e.target.checked }))}
                  className="w-4 h-4 accent-[#534AB7]"
                />
                <span className="text-xs font-semibold text-gray-700">MFA activé</span>
              </label>
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
              {saving ? 'Création…' : 'Créer la plateforme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
