// ═══════════════════════════════════════════
// Page Module Personnalisé — rendu générique
// ═══════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus, X, Save, Loader2, Edit2, Trash2,
  List, Users, FileText, BookOpen, StickyNote, BarChart2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { CustomModule, CustomEntry, CustomModuleType } from '@/types';
import { getPlanLimits, UPGRADE_MSG } from '@/lib/planLimits';
import { PlanGate } from '@/components/PlanGate';

interface CustomModulePageProps {
  modules: CustomModule[];
  plan?: string;
}

// ─── Champs par type de module ───

type FieldDef = { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'url' | 'select'; options?: string[] };

const FIELDS_BY_TYPE: Record<CustomModuleType, FieldDef[]> = {
  liste: [
    { key: 'titre', label: 'Titre', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'statut', label: 'Statut', type: 'select', options: ['À faire', 'En cours', 'Terminé', 'Bloqué'] },
    { key: 'responsable', label: 'Responsable', type: 'text' },
    { key: 'date_echeance', label: 'Date d\'échéance', type: 'date' },
  ],
  contacts: [
    { key: 'nom', label: 'Nom complet', type: 'text' },
    { key: 'poste', label: 'Poste / Rôle', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'telephone', label: 'Téléphone', type: 'text' },
    { key: 'entreprise', label: 'Entreprise', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  documents: [
    { key: 'titre', label: 'Titre du document', type: 'text' },
    { key: 'type', label: 'Type', type: 'select', options: ['Contrat', 'Politique', 'Procédure', 'Rapport', 'Autre'] },
    { key: 'url', label: 'Lien / URL', type: 'url' },
    { key: 'version', label: 'Version', type: 'text' },
    { key: 'date_revision', label: 'Date de révision', type: 'date' },
    { key: 'responsable', label: 'Responsable', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  procedures: [
    { key: 'titre', label: 'Titre de la procédure', type: 'text' },
    { key: 'etape', label: 'Numéro d\'étape', type: 'number' },
    { key: 'action', label: 'Action à réaliser', type: 'textarea' },
    { key: 'acteur', label: 'Acteur responsable', type: 'text' },
    { key: 'outils', label: 'Outils / Systèmes', type: 'text' },
    { key: 'statut', label: 'Statut', type: 'select', options: ['Actif', 'En révision', 'Archivé'] },
  ],
  notes: [
    { key: 'titre', label: 'Titre', type: 'text' },
    { key: 'contenu', label: 'Contenu', type: 'textarea' },
    { key: 'tags', label: 'Tags (séparés par virgule)', type: 'text' },
  ],
  kpis: [
    { key: 'indicateur', label: 'Indicateur', type: 'text' },
    { key: 'valeur', label: 'Valeur', type: 'number' },
    { key: 'unite', label: 'Unité', type: 'text' },
    { key: 'cible', label: 'Cible', type: 'number' },
    { key: 'periode', label: 'Période', type: 'select', options: ['Journalier', 'Hebdomadaire', 'Mensuel', 'Trimestriel', 'Annuel'] },
    { key: 'tendance', label: 'Tendance', type: 'select', options: ['↑ En hausse', '→ Stable', '↓ En baisse'] },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

const TYPE_LABELS: Record<CustomModuleType, string> = {
  liste: 'Liste de tâches',
  contacts: 'Annuaire de contacts',
  documents: 'Bibliothèque de documents',
  procedures: 'Procédures',
  notes: 'Notes',
  kpis: 'Indicateurs (KPIs)',
};

const TYPE_ICONS: Record<CustomModuleType, React.ElementType> = {
  liste: List,
  contacts: Users,
  documents: FileText,
  procedures: BookOpen,
  notes: StickyNote,
  kpis: BarChart2,
};

// ─── Composant principal ───

export function CustomModulePage({ modules, plan }: CustomModulePageProps) {
  const { moduleId } = useParams<{ moduleId: string }>();
  const mod = modules.find((m) => m.id === moduleId);

  const [entries, setEntries] = useState<CustomEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CustomEntry | null>(null);

  useEffect(() => {
    if (!moduleId) return;
    setLoaded(false);
    api.customModules.get(moduleId)
      .then((data) => { setEntries(data.entries ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [moduleId]);

  if (!mod) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Module introuvable</div>
  );

  const fields = FIELDS_BY_TYPE[mod.module_type as CustomModuleType] ?? FIELDS_BY_TYPE.liste;
  const TypeIcon = TYPE_ICONS[mod.module_type as CustomModuleType] ?? List;

  const handleDelete = async (entry: CustomEntry) => {
    try {
      await api.customModules.deleteEntry(mod.id, entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success('Entrée supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSaved = (saved: CustomEntry, isEdit: boolean) => {
    setEntries((prev) =>
      isEdit ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved]
    );
    setShowForm(false);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${mod.color}18` }}>
            <TypeIcon className="w-5 h-5" style={{ color: mod.color }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{mod.title}</h1>
            <p className="text-sm text-gray-500">{mod.description || TYPE_LABELS[mod.module_type as CustomModuleType]}</p>
          </div>
        </div>
        <PlanGate locked={!getPlanLimits(plan).customModulesEnabled} message={UPGRADE_MSG}>
          <button
            onClick={() => { setEditingEntry(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0"
            style={{ backgroundColor: mod.color }}
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </PlanGate>
      </div>

      {/* Contenu */}
      {!loaded ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <TypeIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune entrée pour le moment</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-sm font-medium hover:underline"
            style={{ color: mod.color }}
          >
            Ajouter la première entrée
          </button>
        </div>
      ) : (
        <EntriesTable
          entries={entries}
          fields={fields}
          color={mod.color}
          onEdit={(e) => { setEditingEntry(e); setShowForm(true); }}
          onDelete={handleDelete}
        />
      )}

      {/* Modal formulaire */}
      {showForm && (
        <EntryFormModal
          entry={editingEntry}
          fields={fields}
          moduleId={mod.id}
          color={mod.color}
          title={mod.title}
          onClose={() => { setShowForm(false); setEditingEntry(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ─── Table des entrées ───

function EntriesTable({
  entries, fields, color, onEdit, onDelete,
}: {
  entries: CustomEntry[];
  fields: FieldDef[];
  color: string;
  onEdit: (e: CustomEntry) => void;
  onDelete: (e: CustomEntry) => void;
}) {
  const visibleFields = fields.slice(0, 4); // max 4 colonnes dans le tableau

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {visibleFields.map((f) => (
              <th key={f.key} className="px-4 py-3 text-left font-semibold text-gray-700">{f.label}</th>
            ))}
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
              {visibleFields.map((f) => (
                <td key={f.key} className="px-4 py-3 text-gray-700 max-w-[220px]">
                  {f.type === 'select' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
                      {String(entry.data[f.key] ?? '—')}
                    </span>
                  ) : (
                    <span className="truncate block">{String(entry.data[f.key] ?? '—')}</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(entry)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modal formulaire d'entrée ───

function EntryFormModal({
  entry, fields, moduleId, color, title, onClose, onSaved,
}: {
  entry: CustomEntry | null;
  fields: FieldDef[];
  moduleId: string;
  color: string;
  title: string;
  onClose: () => void;
  onSaved: (saved: CustomEntry, isEdit: boolean) => void;
}) {
  const isEdit = !!entry;
  const [form, setForm] = useState<Record<string, unknown>>(
    entry?.data ?? Object.fromEntries(fields.map((f) => [f.key, f.type === 'number' ? 0 : '']))
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.customModules.updateEntry(moduleId, entry!.id, form)
        : await api.customModules.createEntry(moduleId, form);
      toast.success(isEdit ? 'Entrée modifiée' : 'Entrée ajoutée');
      onSaved(saved, isEdit);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Modifier' : 'Ajouter'} — {title}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  value={String(form[f.key] ?? '')}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:border-[#534AB7] outline-none resize-none"
                  style={{ '--tw-ring-color': `${color}40` } as React.CSSProperties}
                />
              ) : f.type === 'select' ? (
                <select
                  value={String(form[f.key] ?? '')}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none"
                >
                  <option value="">— Sélectionner —</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={String(form[f.key] ?? '')}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: f.type === 'number' ? +e.target.value : e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-[#534AB7]"
                />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: color }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
