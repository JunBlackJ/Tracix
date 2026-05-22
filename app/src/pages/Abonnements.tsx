// ═══════════════════════════════════════════
// Page Abonnements
// ═══════════════════════════════════════════

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, Plus, Clock, XCircle, RefreshCw, FileSpreadsheet, X, Save, Loader2, Edit2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Subscription, BillingCycle, SubscriptionStatus, Category } from '@/types';

interface AbonnementsProps {
  subscriptions: Subscription[];
  categories?: Category[];
  onSubscriptionCreated?: (s: Subscription) => void;
  onSubscriptionUpdated?: (s: Subscription) => void;
}

// Taux de conversion approximatifs (base EUR)
const FX: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  XOF: 655.96,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  XOF: 'FCFA',
};

function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = FX[fromCurrency] ?? 1;
  const toRate = FX[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

export function Abonnements({ subscriptions, categories = [], onSubscriptionCreated, onSubscriptionUpdated }: AbonnementsProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('EUR');

  const filtered = subscriptions.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  // Total converti dans la devise choisie
  const totalMonthly = filtered.reduce((sum, s) => {
    const monthly = s.billing_cycle === 'mensuel' ? s.cost_monthly : s.cost_annual / 12;
    return sum + convertAmount(monthly, s.currency, displayCurrency);
  }, 0);

  const totalAnnual = filtered.reduce((sum, s) => {
    const annual = s.billing_cycle === 'annuel' ? s.cost_annual : s.cost_monthly * 12;
    return sum + convertAmount(annual, s.currency, displayCurrency);
  }, 0);

  const sym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;

  const statusConfig: Record<string, { bg: string; text: string }> = {
    actif: { bg: 'bg-green-100', text: 'text-green-700' },
    'à_résilier': { bg: 'bg-amber-100', text: 'text-amber-700' },
    expiré: { bg: 'bg-red-100', text: 'text-red-700' },
    'en_négociation': { bg: 'bg-blue-100', text: 'text-blue-700' },
  };

  const handleExport = () => {
    if (filtered.length === 0) { toast.error('Aucun abonnement à exporter'); return; }
    const rows = filtered.map((s) => ({
      'Nom': s.name,
      'Catégorie': s.category,
      'Fournisseur': s.vendor,
      'Coût mensuel': s.cost_monthly,
      'Coût annuel': s.cost_annual,
      'Devise': s.currency,
      'Cycle': s.billing_cycle,
      'Date renouvellement': s.renewal_date ? new Date(s.renewal_date).toLocaleDateString('fr-FR') : '',
      'Renouvellement auto': s.auto_renew ? 'Oui' : 'Non',
      'Responsable': s.responsible,
      'Statut': s.status,
      'URL contrat': s.contract_url,
      'Notes': s.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Abonnements');
    XLSX.writeFile(wb, `abonnements_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filtered.length} abonnements exportés`);
  };

  const handleSaved = (s: Subscription) => {
    setShowForm(false);
    if (editingSub) {
      onSubscriptionUpdated?.(s);
      toast.success('Abonnement modifié');
    } else {
      onSubscriptionCreated?.(s);
      toast.success('Abonnement créé');
    }
    setEditingSub(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Abonnements</h1>
          <p className="text-sm text-gray-500">{subscriptions.length} abonnements suivis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export XLSX
          </button>
          <button
            onClick={() => { setEditingSub(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvel abonnement
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-48 focus:ring-2 focus:ring-[#534AB7]/20 outline-none"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none">
          <option value="all">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="à_résilier">À résilier</option>
          <option value="expiré">Expiré</option>
          <option value="en_négociation">En négociation</option>
        </select>

        {/* Sélecteur devise du total */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Total en :</span>
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#534AB7]/20"
          >
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
            <option value="GBP">GBP £</option>
            <option value="XOF">XOF FCFA</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Nom</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Catégorie</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Fournisseur</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Mensuel</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Annuel</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Cycle</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Renouvellement</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Responsable</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const renewalDays = Math.floor((new Date(s.renewal_date).getTime() - new Date().getTime()) / 86400000);
              const isExpiringSoon = renewalDays > 0 && renewalDays <= 30;
              const isExpired = renewalDays < 0;

              return (
                <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isExpired ? 'bg-red-50/50' : isExpiringSoon ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.category}</td>
                  <td className="px-4 py-3 text-gray-600">{s.vendor}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">{s.cost_monthly.toFixed(2)} {s.currency}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">{s.cost_annual.toFixed(2)} {s.currency}</td>
                  <td className="px-4 py-3 text-gray-600">{s.billing_cycle}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs flex items-center gap-1 whitespace-nowrap ${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                      {isExpired && <XCircle className="w-3 h-3" />}
                      {isExpiringSoon && <Clock className="w-3 h-3" />}
                      {s.renewal_date ? new Date(s.renewal_date).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusConfig[s.status]?.bg || 'bg-gray-100'} ${statusConfig[s.status]?.text || 'text-gray-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.responsible}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setEditingSub(s); setShowForm(true); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#534AB7] transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucun abonnement ne correspond aux filtres
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-[#534AB7]/5">
              <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">
                TOTAL
                <span className="ml-2 text-[11px] font-normal text-gray-400">({filtered.length} abonnements · converti en {displayCurrency})</span>
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                {totalMonthly.toFixed(2)} {sym}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#534AB7] whitespace-nowrap">
                {totalAnnual.toFixed(2)} {sym}
              </td>
              <td colSpan={5} className="px-4 py-3 text-xs text-gray-400 italic">
                Taux indicatifs — EUR·USD·GBP·XOF
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showForm && (
        <SubscriptionFormModal
          subscription={editingSub}
          categories={categories}
          onClose={() => { setShowForm(false); setEditingSub(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ─── Modal formulaire abonnement ───

interface SubscriptionFormModalProps {
  subscription: Subscription | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (s: Subscription) => void;
}

function SubscriptionFormModal({ subscription, categories, onClose, onSaved }: SubscriptionFormModalProps) {
  const isEdit = !!subscription;

  const [form, setForm] = useState({
    name: subscription?.name ?? '',
    category: subscription?.category ?? '',
    vendor: subscription?.vendor ?? '',
    cost_monthly: subscription?.cost_monthly ?? 0,
    cost_annual: subscription?.cost_annual ?? 0,
    currency: subscription?.currency ?? 'EUR',
    billing_cycle: (subscription?.billing_cycle ?? 'annuel') as BillingCycle,
    renewal_date: subscription?.renewal_date ? subscription.renewal_date.slice(0, 10) : '',
    auto_renew: subscription?.auto_renew ?? false,
    responsible: subscription?.responsible ?? '',
    status: (subscription?.status ?? 'actif') as SubscriptionStatus,
    contract_url: subscription?.contract_url ?? '',
    notes: subscription?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  const validate = () => {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.name.trim()) e.name = 'Requis';
    if (!form.renewal_date) e.renewal_date = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost_monthly: Number(form.cost_monthly),
        cost_annual: Number(form.cost_annual),
      };
      const saved = isEdit
        ? await api.subscriptions.update(subscription!.id, payload)
        : await api.subscriptions.create(payload);
      onSaved(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Erreur : ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (field: keyof typeof form) =>
    `w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Modifier — ${subscription!.name}` : 'Nouvel abonnement'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nom du service *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass('name')}
              placeholder="Ex: GitHub Enterprise, AWS, Slack…"
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-0.5">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
              {categories.length > 0 ? (
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={inputClass('category')}
                >
                  <option value="">— Sélectionner —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.label}>{c.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={inputClass('category')}
                  placeholder="Ex: Dev, Sécurité, Cloud…"
                />
              )}
              {categories.length === 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">Ajoutez des catégories dans Paramètres → Catégories</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fournisseur</label>
              <input
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                className={inputClass('vendor')}
                placeholder="Ex: GitHub Inc."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Coût mensuel</label>
              <input
                type="number" min="0" step="0.01"
                value={form.cost_monthly}
                onChange={(e) => setForm((f) => ({ ...f, cost_monthly: parseFloat(e.target.value) || 0 }))}
                className={inputClass('cost_monthly')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Coût annuel</label>
              <input
                type="number" min="0" step="0.01"
                value={form.cost_annual}
                onChange={(e) => setForm((f) => ({ ...f, cost_annual: parseFloat(e.target.value) || 0 }))}
                className={inputClass('cost_annual')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Devise</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className={inputClass('currency')}
              >
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
                <option value="XOF">XOF FCFA</option>
                <option value="GBP">GBP £</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cycle de facturation</label>
              <select
                value={form.billing_cycle}
                onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value as BillingCycle }))}
                className={inputClass('billing_cycle')}
              >
                <option value="mensuel">Mensuel</option>
                <option value="annuel">Annuel</option>
                <option value="usage">À l'usage</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date de renouvellement *</label>
              <input
                type="date"
                value={form.renewal_date}
                onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))}
                className={inputClass('renewal_date')}
              />
              {errors.renewal_date && <p className="text-[11px] text-red-500 mt-0.5">{errors.renewal_date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SubscriptionStatus }))}
                className={inputClass('status')}
              >
                <option value="actif">Actif</option>
                <option value="à_résilier">À résilier</option>
                <option value="expiré">Expiré</option>
                <option value="en_négociation">En négociation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
              <input
                value={form.responsible}
                onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))}
                className={inputClass('responsible')}
                placeholder="Ex: Antoine Martin"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="auto_renew"
              checked={form.auto_renew}
              onChange={(e) => setForm((f) => ({ ...f, auto_renew: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7]"
            />
            <label htmlFor="auto_renew" className="text-sm text-gray-700 cursor-pointer">
              Renouvellement automatique activé
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">URL du contrat</label>
            <input
              value={form.contract_url}
              onChange={(e) => setForm((f) => ({ ...f, contract_url: e.target.value }))}
              className={inputClass('contract_url')}
              placeholder="https://…"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
              {saving ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Créer l\'abonnement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
