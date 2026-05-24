// ═══════════════════════════════════════════
// Page Import — Excel intelligent
// ═══════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, X, ChevronRight,
  ShieldCheck, CheckCircle2,
  AlertCircle, ArrowRight, Loader2, RefreshCw, Sparkles,
  Tag, Mail, Building2, Layers, ArrowRightLeft, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';

// ─── Types ───
interface RawSheet {
  name: string;
  allRows: string[][];  // toutes les lignes brutes
}

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  memberCol: number | null;
  teamCol: number | null;
  emailCol: number | null;
}

interface AiSuggestion {
  fileType: 'access_matrix' | 'access_matrix_transposed' | 'platform_inventory' | 'subscription_inventory' | 'system_inventory' | 'network_flow_inventory' | 'member_list' | 'unknown';
  headerRowIndex: number;
  subHeaderRowIndex: number | null;
  dataEndRow: number | null;
  warnings: string[];
  memberCol: number | null;
  firstNameCol: number | null;
  lastNameCol: number | null;
  teamCol: number | null;
  emailCol: number | null;
  platformCols: number[];
  levelMappings: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>;
  memberRow: number | null;
  platformCol: number | null;
  nameCol: number | null;
  categoryCol: number | null;
  urlCol: number | null;
  vendorCol: number | null;
  renewalCol: number | null;
  statusCol: number | null;
  costMonthlyCol: number | null;
  costAnnualCol: number | null;
  currencyCol: number | null;
  ipCol: number | null;
  osCol: number | null;
  typeCol: number | null;
  criticalityCol: number | null;
  responsibleCol: number | null;
  sourceCol: number | null;
  destinationCol: number | null;
  portCol: number | null;
  protocolCol: number | null;
  directionCol: number | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface ImportResult {
  created: { members: number; platforms: number; accessRights: number; subscriptions?: number; systems?: number; flows?: number };
  skipped: { members: number; platforms: number; subscriptions?: number; systems?: number };
  fileType?: string;
}

interface BatchPayload {
  members: { full_name: string; email?: string; team?: string }[];
  platforms: { name: string }[];
  access: { memberName: string; platformName: string; level: 'admin' | 'rw' | 'ro' | 'req' }[];
}

// ─── Propage les cellules fusionnées (valeur vide = hérite de la cellule au-dessus) ───
function fillMergedCells(rows: string[][]): string[][] {
  const filled = rows.map((r) => [...r]);
  for (let col = 0; col < (filled[0]?.length ?? 0); col++) {
    let last = '';
    for (let row = 0; row < filled.length; row++) {
      const val = String(filled[row][col] ?? '').trim();
      if (val) { last = val; } else if (last) { filled[row][col] = last; }
    }
  }
  return filled;
}

// ─── Construit un ParsedSheet depuis un RawSheet + suggestion IA ───
function applyAiToSheet(raw: RawSheet, ai: AiSuggestion): ParsedSheet {
  // Matrice transposée : on pivote avant tout
  if (ai.fileType === 'access_matrix_transposed') {
    const allRows = raw.allRows;
    const memberRow = ai.memberRow ?? ai.headerRowIndex;
    const platCol = ai.platformCol ?? 0;
    const end = ai.dataEndRow ?? allRows.length;
    // headers = noms des personnes (depuis la ligne memberRow, sans la colonne plateforme)
    const memberNames = (allRows[memberRow] ?? []).map(String).filter((_, i) => i !== platCol);
    // lignes de données = lignes après memberRow jusqu'à dataEndRow
    const dataRows = allRows.slice(memberRow + 1, end).filter((r) => r.some((c) => String(c).trim() !== ''));
    // On reconstruit une matrice normale : lignes=personnes, cols=plateformes
    const pivotHeaders = ['Membre', ...dataRows.map((r) => String(r[platCol] ?? '').trim()).filter(Boolean)];
    const pivotRows = memberNames.map((name, mi) => {
      const row: string[] = [name];
      for (const dataRow of dataRows) {
        row.push(String(dataRow[mi + (mi >= platCol ? 1 : 0)] ?? ''));
      }
      return row;
    }).filter((r) => r[0]);
    return { name: raw.name, headers: pivotHeaders, rows: pivotRows };
  }

  const headerRow = raw.allRows[ai.headerRowIndex] ?? [];
  const end = ai.dataEndRow ?? raw.allRows.length;
  let dataRows = raw.allRows.slice(ai.headerRowIndex + 1, end)
    .filter((r) => r.some((c) => String(c).trim() !== ''));

  // Propager les cellules fusionnées (ex: colonne équipe vide sur les lignes 2-5 d'un même groupe)
  dataRows = fillMergedCells(dataRows);

  // Construire les en-têtes : si double ligne d'en-têtes, fusionner les deux
  let headers = headerRow.map(String);
  if (ai.subHeaderRowIndex !== null && ai.subHeaderRowIndex !== undefined) {
    const subRow = (raw.allRows[ai.subHeaderRowIndex] ?? []).map(String);
    headers = headers.map((h, i) => {
      const sub = subRow[i] ?? '';
      return h && sub && sub !== h ? `${h} — ${sub}` : h || sub;
    });
  }

  // Si prénom/nom séparés, ajouter une colonne virtuelle "Prénom Nom" à la fin
  const rows = dataRows.map((r) => {
    const row = r.map(String);
    if (ai.firstNameCol !== null && ai.lastNameCol !== null) {
      const fn = String(row[ai.firstNameCol] ?? '').trim();
      const ln = String(row[ai.lastNameCol] ?? '').trim();
      row.push(`${fn} ${ln}`.trim());
    }
    return row;
  });

  if (ai.firstNameCol !== null && ai.lastNameCol !== null) {
    headers = [...headers, '_full_name'];
  }

  return { name: raw.name, headers, rows };
}

// ─── Détection fallback sans IA ───
function detectColumns(headers: string[]): ColumnMapping {
  const h = headers.map((x) => x.toLowerCase().trim());
  const find = (keywords: string[]): number | null => {
    for (const kw of keywords) {
      const idx = h.findIndex((x) => x.includes(kw));
      if (idx !== -1) return idx;
    }
    return null;
  };
  return {
    memberCol: find(['nom', 'name', 'membre', 'member', 'collaborateur', 'prenom', 'prénom', 'utilisateur', 'user', 'fullname', 'full_name']),
    teamCol: find(['equipe', 'équipe', 'team', 'department', 'département', 'service', 'groupe', 'division', 'pole', 'pôle']),
    emailCol: find(['email', 'mail', 'courriel', 'e-mail', 'adresse']),
  };
}

function normalizeLevel(
  raw: string,
  aiMappings?: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>
): 'admin' | 'rw' | 'ro' | 'req' | 'none' {
  const v = raw.toLowerCase().trim();
  if (!v || v === '-' || v === '—') return 'none';
  if (aiMappings) {
    const key = Object.keys(aiMappings).find((k) => k.toLowerCase() === v);
    if (key) return aiMappings[key];
  }
  if (v === 'none' || v === 'aucun' || v === 'non' || v === 'no' || v === '0' || v === 'false') return 'none';
  if (v === 'admin' || v === 'administrator' || v === 'administrateur' || v === 'a') return 'admin';
  if (v.includes('rw') || v.includes('write') || v === 'ecriture' || v === 'écriture' || v === 'editor' || v === 'editeur' || v === 'full' || v === 'oui' || v === 'yes' || v === 'x' || v === '✓' || v === '1' || v === 'true') return 'rw';
  if (v.includes('ro') || v === 'read' || v === 'lecture' || v === 'viewer' || v === 'lecteur') return 'ro';
  if (v === 'req' || v === 'request' || v === 'demande') return 'req';
  return 'none';
}

const LEVEL_STYLE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  rw: 'bg-amber-100 text-amber-700',
  ro: 'bg-blue-100 text-blue-700',
  req: 'bg-purple-100 text-purple-700',
};
const LEVEL_LABEL: Record<string, string> = { admin: 'ADMIN', rw: 'RW', ro: 'RO', req: 'REQ' };
const CONFIDENCE_BORDER: Record<string, string> = { high: 'border-emerald-400', medium: 'border-amber-400', low: 'border-red-400' };
const CONFIDENCE_DOT: Record<string, string> = { high: 'bg-emerald-400', medium: 'bg-amber-400', low: 'bg-red-400' };
const CONFIDENCE_LABEL_MAP: Record<string, string> = { high: 'Confiance élevée', medium: 'Confiance moyenne', low: 'Confiance faible' };

// ─── Modal IA ───
interface AiModalProps {
  open: boolean;
  loading: boolean;
  suggestion: AiSuggestion | null;
  error: string | null;
  sheet: ParsedSheet | null;
  rawSheet: RawSheet | null;
  rawSheets: RawSheet[];
  activeSheet: number;
  mapping: ColumnMapping;
  platformCols: { h: string; i: number }[];
  allPlatformCols: { h: string; i: number }[];
  excludedPlatformCols: Set<number>;
  payload: BatchPayload;
  importing: boolean;
  onSelectSheet: (i: number) => void;
  onTogglePlatform: (i: number) => void;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
  // multi-sheet
  aiSuggestions: Record<number, AiSuggestion | null>;
  aiLoadingSheets: Set<number>;
  selectedSheets: Set<number>;
  multiImporting: boolean;
  onToggleSheet: (i: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onConfirmMulti: () => void;
}

function AiModal({
  open, loading, suggestion, error, sheet, rawSheet,
  rawSheets, activeSheet,
  mapping, platformCols, allPlatformCols, excludedPlatformCols,
  payload, importing, onSelectSheet, onTogglePlatform, onConfirm, onEdit, onClose,
  aiSuggestions, aiLoadingSheets, selectedSheets, multiImporting,
  onToggleSheet, onSelectAll, onDeselectAll, onConfirmMulti,
}: AiModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  const sheetName = rawSheet?.name ?? sheet?.name ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#534AB7]/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#534AB7]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Analyse IA</p>
            <p className="text-xs text-gray-400 truncate">{sheetName}</p>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Multi-sheet selector */}
          {rawSheets.length > 1 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">{rawSheets.length} feuilles — choisissez lesquelles importer</p>
                <div className="flex gap-1.5">
                  <button onClick={onSelectAll} className="text-[10px] px-2 py-0.5 rounded bg-[#534AB7]/10 text-[#534AB7] hover:bg-[#534AB7]/20 font-medium transition-colors">Tout</button>
                  <button onClick={onDeselectAll} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-500 hover:bg-gray-300 font-medium transition-colors">Aucun</button>
                </div>
              </div>
              <div className="space-y-1">
                {rawSheets.map((s, i) => {
                  const sug = aiSuggestions[i];
                  const isLoading = aiLoadingSheets.has(i);
                  const isSelected = selectedSheets.has(i);
                  const isActive = activeSheet === i;
                  const typeLabel = sug
                    ? sug.fileType === "access_matrix" || sug.fileType === "access_matrix_transposed" ? "Matrice"
                    : sug.fileType === "platform_inventory" ? "Plateformes"
                    : sug.fileType === "system_inventory" ? "Systèmes"
                    : sug.fileType === "network_flow_inventory" ? "Flux réseau"
                    : sug.fileType === "subscription_inventory" ? "Abonnements"
                    : sug.fileType === "member_list" ? "Membres"
                    : "Inconnu"
                    : null;
                  const typeColor = sug
                    ? sug.fileType === "access_matrix" || sug.fileType === "access_matrix_transposed" ? "bg-[#534AB7]/10 text-[#534AB7]"
                    : sug.fileType === "platform_inventory" ? "bg-emerald-100 text-emerald-700"
                    : sug.fileType === "system_inventory" ? "bg-orange-100 text-orange-700"
                    : sug.fileType === "network_flow_inventory" ? "bg-rose-100 text-rose-700"
                    : sug.fileType === "subscription_inventory" ? "bg-blue-100 text-blue-700"
                    : sug.fileType === "member_list" ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-500"
                    : "bg-gray-100 text-gray-400";
                  return (
                    <div key={i}
                      className={"flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors " + (isActive ? "border-[#534AB7]/40 bg-white" : isSelected ? "border-gray-200 bg-white/60" : "border-transparent bg-transparent opacity-50")}
                      onClick={() => { onToggleSheet(i); onSelectSheet(i); }}
                    >
                      <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={function(e){ e.stopPropagation(); onToggleSheet(i); }} className="w-3.5 h-3.5 accent-[#534AB7] flex-shrink-0" />
                      <span className={"text-xs font-medium flex-1 truncate " + (isActive ? "text-[#534AB7]" : "text-gray-700")}>{s.name}</span>
                      {isLoading
                        ? <Loader2 className="w-3 h-3 text-[#534AB7] animate-spin flex-shrink-0" />
                        : typeLabel
                        ? <span className={"px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 " + typeColor}>{typeLabel}</span>
                        : <span className="text-[10px] text-gray-300 flex-shrink-0">…</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#534AB7]/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#534AB7]" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Claude analyse votre fichier…</p>
                <p className="text-xs text-gray-400 text-center">Détection de la structure, des colonnes et des valeurs d'accès</p>
              </div>
              {['Identification de la ligne d\'en-têtes réelle', 'Détection des colonnes membres et équipes', 'Reconnaissance des plateformes', 'Normalisation des valeurs d\'accès'].map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <Loader2 className="w-4 h-4 text-[#534AB7] animate-spin flex-shrink-0" />
                  <p className="text-sm text-gray-500">{t}</p>
                </div>
              ))}
            </div>
          )}

          {/* Erreur */}
          {error && !loading && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700">Analyse IA indisponible</p>
                <p className="text-xs text-amber-600 mt-1">{error}</p>
                <p className="text-xs text-amber-500 mt-1">La détection automatique a été utilisée.</p>
              </div>
            </div>
          )}

          {/* Rapport */}
          {suggestion && !loading && sheet && (
            <>
              {/* Badge type + confidence */}
              <div className="flex items-start gap-3">
                <div className={`flex items-start gap-3 flex-1 p-4 rounded-xl border-l-4 bg-gray-50 ${CONFIDENCE_BORDER[suggestion.confidence]}`}>
                  <div className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${CONFIDENCE_DOT[suggestion.confidence]}`} />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-bold text-gray-700">{CONFIDENCE_LABEL_MAP[suggestion.confidence]}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        suggestion.fileType === 'access_matrix' || suggestion.fileType === 'access_matrix_transposed' ? 'bg-[#534AB7]/10 text-[#534AB7]'
                        : suggestion.fileType === 'platform_inventory' ? 'bg-emerald-100 text-emerald-700'
                        : suggestion.fileType === 'subscription_inventory' ? 'bg-blue-100 text-blue-700'
                        : suggestion.fileType === 'system_inventory' ? 'bg-orange-100 text-orange-700'
                        : suggestion.fileType === 'network_flow_inventory' ? 'bg-rose-100 text-rose-700'
                        : suggestion.fileType === 'member_list' ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {suggestion.fileType === 'access_matrix' ? 'Matrice d\'habilitations'
                          : suggestion.fileType === 'access_matrix_transposed' ? 'Matrice inversée (pivotée)'
                          : suggestion.fileType === 'platform_inventory' ? 'Inventaire de plateformes'
                          : suggestion.fileType === 'subscription_inventory' ? 'Inventaire d\'abonnements'
                          : suggestion.fileType === 'system_inventory' ? 'Inventaire de systèmes'
                          : suggestion.fileType === 'network_flow_inventory' ? 'Flux réseau'
                          : suggestion.fileType === 'member_list' ? 'Liste de membres'
                          : 'Type inconnu'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{suggestion.notes}</p>
                  </div>
                </div>
              </div>

              {/* Structure */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Ligne d'en-têtes</p>
                  <p className="text-xs font-bold text-gray-800">Ligne {suggestion.headerRowIndex + 1}</p>
                  {suggestion.subHeaderRowIndex !== null && suggestion.subHeaderRowIndex !== undefined && (
                    <p className="text-[10px] text-amber-500 mt-0.5">Double en-tête détecté (L{suggestion.subHeaderRowIndex + 1}) — fusionné</p>
                  )}
                  {suggestion.headerRowIndex > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{suggestion.headerRowIndex} ligne{suggestion.headerRowIndex > 1 ? 's' : ''} de titre ignorée{suggestion.headerRowIndex > 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Données</p>
                  <p className="text-xs font-bold text-gray-800">{sheet.rows.length} lignes</p>
                  {suggestion.dataEndRow !== null && rawSheet && suggestion.dataEndRow < rawSheet.allRows.length && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{rawSheet.allRows.length - suggestion.dataEndRow} ligne{rawSheet.allRows.length - suggestion.dataEndRow > 1 ? 's' : ''} ignorée{rawSheet.allRows.length - suggestion.dataEndRow > 1 ? 's' : ''} (bas)</p>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {suggestion.warnings?.length > 0 && (
                <div className="space-y-1">
                  {suggestion.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── MATRICE D'HABILITATIONS ── */}
              {suggestion.fileType === 'access_matrix' && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Colonnes détectées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Users, label: 'Membres', col: suggestion.memberCol, color: '#534AB7', required: true },
                        { icon: Building2, label: 'Équipe', col: suggestion.teamCol, color: '#1D9E75', required: false },
                        { icon: Mail, label: 'Email', col: suggestion.emailCol, color: '#EF9F27', required: false },
                        { icon: Layers, label: 'Plateformes', col: platformCols.length > 0 ? 0 : null, color: '#E5628A', required: false, override: platformCols.length > 0 ? `${platformCols.length} colonne${platformCols.length > 1 ? 's' : ''}` : null },
                      ].map(({ icon: Icon, label, col, color, required, override }) => {
                        const colName = override ?? (col !== null ? `« ${sheet.headers[col!]} »` : null);
                        return (
                          <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                              <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}{required && ' *'}</p>
                              {colName ? <p className="text-xs font-semibold text-gray-800 truncate">{colName}</p> : <p className="text-xs text-gray-300 italic">Non détecté</p>}
                            </div>
                            {colName ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-200 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {allPlatformCols.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Plateformes <span className="normal-case font-normal text-gray-300">— cliquez pour exclure</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allPlatformCols.map(({ h, i }) => {
                          const excluded = excludedPlatformCols.has(i);
                          return (
                            <button key={i} onClick={() => onTogglePlatform(i)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${excluded ? 'border-gray-200 bg-gray-50 text-gray-300 line-through' : 'border-[#534AB7]/20 bg-[#534AB7]/5 text-[#534AB7] hover:bg-[#534AB7]/10'}`}>
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {Object.entries(suggestion.levelMappings).filter(([, v]) => v !== 'none').length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Valeurs d'accès reconnues</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(suggestion.levelMappings).filter(([, v]) => v !== 'none').map(([raw, normalized]) => (
                          <div key={raw} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                            <Tag className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-mono text-gray-600">« {raw} »</span>
                            <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_STYLE[normalized]}`}>{LEVEL_LABEL[normalized]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {mapping.memberCol !== null && sheet.rows.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Aperçu</p>
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Membre</th>
                                {mapping.teamCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Équipe</th>}
                                {mapping.emailCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Email</th>}
                                {platformCols.slice(0, 5).map(({ h }) => <th key={h} className="px-3 py-2 text-left font-semibold text-[#534AB7] whitespace-nowrap">{h}</th>)}
                                {platformCols.length > 5 && <th className="px-3 py-2 text-gray-400 font-normal whitespace-nowrap">+{platformCols.length - 5}</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {sheet.rows.slice(0, 6).map((row, ri) => {
                                const memberName = String(row[mapping.memberCol!] ?? '').trim();
                                if (!memberName) return null;
                                return (
                                  <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{memberName}</td>
                                    {mapping.teamCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[mapping.teamCol] ?? '')}</td>}
                                    {mapping.emailCol !== null && <td className="px-3 py-2 text-gray-400 font-mono text-[10px] whitespace-nowrap">{String(row[mapping.emailCol] ?? '')}</td>}
                                    {platformCols.slice(0, 5).map(({ i }) => {
                                      const rawVal = String(row[i] ?? '');
                                      const level = normalizeLevel(rawVal, suggestion.levelMappings);
                                      return (
                                        <td key={i} className="px-3 py-2 whitespace-nowrap">
                                          {level !== 'none' ? (
                                            <div className="flex items-center gap-1">
                                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_STYLE[level]}`}>{LEVEL_LABEL[level]}</span>
                                              {rawVal && rawVal.toLowerCase() !== level && <span className="text-[9px] text-gray-400 font-mono">({rawVal})</span>}
                                            </div>
                                          ) : <span className="text-gray-300">—</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">{payload.members.length} membres · {payload.platforms.length} plateformes · {payload.access.length} droits d'accès détectés</p>
                    </div>
                  )}
                </>
              )}

              {/* ── INVENTAIRE DE PLATEFORMES ── */}
              {suggestion.fileType === 'platform_inventory' && suggestion.nameCol !== null && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Colonnes détectées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Layers, label: 'Nom', col: suggestion.nameCol, color: '#1D9E75', required: true },
                        { icon: Tag, label: 'Catégorie', col: suggestion.categoryCol, color: '#534AB7', required: false },
                        { icon: ArrowRight, label: 'URL', col: suggestion.urlCol, color: '#EF9F27', required: false },
                        { icon: ShieldCheck, label: 'Statut', col: suggestion.statusCol, color: '#E5628A', required: false },
                      ].map(({ icon: Icon, label, col, color, required }) => {
                        const colName = col !== null ? `« ${sheet.headers[col!]} »` : null;
                        return (
                          <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                              <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}{required && ' *'}</p>
                              {colName ? <p className="text-xs font-semibold text-gray-800 truncate">{colName}</p> : <p className="text-xs text-gray-300 italic">Non détecté</p>}
                            </div>
                            {colName ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-200 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Aperçu</p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-emerald-700 whitespace-nowrap">Nom</th>
                              {suggestion.categoryCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Catégorie</th>}
                              {suggestion.urlCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">URL</th>}
                              {suggestion.statusCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Statut</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sheet.rows.slice(0, 6).map((row, ri) => {
                              const name = String(row[suggestion.nameCol!] ?? '').trim();
                              if (!name) return null;
                              return (
                                <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                                  {suggestion.categoryCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[suggestion.categoryCol] ?? '')}</td>}
                                  {suggestion.urlCol !== null && <td className="px-3 py-2 text-gray-400 font-mono text-[10px] whitespace-nowrap">{String(row[suggestion.urlCol] ?? '')}</td>}
                                  {suggestion.statusCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[suggestion.statusCol] ?? '')}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">{sheet.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length} plateformes détectées</p>
                  </div>
                </>
              )}

              {/* ── MATRICE TRANSPOSÉE (traitement identique à access_matrix après pivot) ── */}
              {suggestion.fileType === 'access_matrix_transposed' && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#534AB7]/5 border border-[#534AB7]/20">
                  <Sparkles className="w-3.5 h-3.5 text-[#534AB7] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#534AB7]">Matrice inversée détectée — pivotée automatiquement pour l'import (plateformes → colonnes, personnes → lignes)</p>
                </div>
              )}

              {/* ── INVENTAIRE DE SYSTÈMES ── */}
              {suggestion.fileType === 'system_inventory' && suggestion.nameCol !== null && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Colonnes détectées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Hostname/Nom', col: suggestion.nameCol, required: true },
                        { label: 'Adresse IP', col: suggestion.ipCol, required: false },
                        { label: 'OS', col: suggestion.osCol, required: false },
                        { label: 'Type', col: suggestion.typeCol, required: false },
                        { label: 'Criticité', col: suggestion.criticalityCol, required: false },
                        { label: 'Statut', col: suggestion.statusCol, required: false },
                      ].map(({ label, col, required }) => (
                        <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}{required && ' *'}</p>
                            {col !== null ? <p className="text-xs font-semibold text-gray-800 truncate">« {sheet.headers[col!]} »</p> : <p className="text-xs text-gray-300 italic">Non détecté</p>}
                          </div>
                          {col !== null ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-200 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">{sheet.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length} systèmes détectés</p>
                </>
              )}

              {/* ── FLUX RÉSEAU ── */}
              {suggestion.fileType === 'network_flow_inventory' && suggestion.sourceCol !== null && suggestion.destinationCol !== null && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Colonnes détectées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Source', col: suggestion.sourceCol, required: true },
                        { label: 'Destination', col: suggestion.destinationCol, required: true },
                        { label: 'Port', col: suggestion.portCol, required: false },
                        { label: 'Protocole', col: suggestion.protocolCol, required: false },
                        { label: 'Direction', col: suggestion.directionCol, required: false },
                        { label: 'Statut', col: suggestion.statusCol, required: false },
                      ].map(({ label, col, required }) => (
                        <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}{required && ' *'}</p>
                            {col !== null ? <p className="text-xs font-semibold text-gray-800 truncate">« {sheet.headers[col!]} »</p> : <p className="text-xs text-gray-300 italic">Non détecté</p>}
                          </div>
                          {col !== null ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-200 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">{sheet.rows.filter(r => String(r[suggestion.sourceCol!] ?? '').trim()).length} flux détectés</p>
                </>
              )}

              {/* ── INVENTAIRE D'ABONNEMENTS ── */}
              {suggestion.fileType === 'subscription_inventory' && suggestion.nameCol !== null && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Colonnes détectées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Tag, label: 'Nom', col: suggestion.nameCol, color: '#534AB7', required: true },
                        { icon: Building2, label: 'Fournisseur', col: suggestion.vendorCol, color: '#1D9E75', required: false },
                        { icon: Tag, label: 'Catégorie', col: suggestion.categoryCol, color: '#EF9F27', required: false },
                        { icon: ArrowRight, label: 'Renouvellement', col: suggestion.renewalCol, color: '#E5628A', required: false },
                        { icon: ShieldCheck, label: 'Statut', col: suggestion.statusCol, color: '#6B7280', required: false },
                      ].map(({ icon: Icon, label, col, color, required }) => {
                        const colName = col !== null ? `« ${sheet.headers[col!]} »` : null;
                        return (
                          <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                              <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}{required && ' *'}</p>
                              {colName ? <p className="text-xs font-semibold text-gray-800 truncate">{colName}</p> : <p className="text-xs text-gray-300 italic">Non détecté</p>}
                            </div>
                            {colName ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-200 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Aperçu</p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-[#534AB7] whitespace-nowrap">Nom</th>
                              {suggestion.vendorCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Fournisseur</th>}
                              {suggestion.categoryCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Catégorie</th>}
                              {suggestion.renewalCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Renouvellement</th>}
                              {suggestion.statusCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Statut</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sheet.rows.slice(0, 6).map((row, ri) => {
                              const name = String(row[suggestion.nameCol!] ?? '').trim();
                              if (!name) return null;
                              return (
                                <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                                  {suggestion.vendorCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[suggestion.vendorCol] ?? '')}</td>}
                                  {suggestion.categoryCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[suggestion.categoryCol] ?? '')}</td>}
                                  {suggestion.renewalCol !== null && <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{String(row[suggestion.renewalCol] ?? '')}</td>}
                                  {suggestion.statusCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[suggestion.statusCol] ?? '')}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">{sheet.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length} abonnements détectés</p>
                  </div>
                </>
              )}

              {/* ── LISTE DE MEMBRES ── */}
              {suggestion.fileType === 'member_list' && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Colonnes détectées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Users, label: 'Membres', col: suggestion.memberCol, color: '#534AB7', required: true },
                        { icon: Building2, label: 'Équipe', col: suggestion.teamCol, color: '#1D9E75', required: false },
                        { icon: Mail, label: 'Email', col: suggestion.emailCol, color: '#EF9F27', required: false },
                      ].map(({ icon: Icon, label, col, color, required }) => {
                        const colName = col !== null ? `« ${sheet.headers[col!]} »` : null;
                        return (
                          <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                              <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}{required && ' *'}</p>
                              {colName ? <p className="text-xs font-semibold text-gray-800 truncate">{colName}</p> : <p className="text-xs text-gray-300 italic">Non détecté</p>}
                            </div>
                            {colName ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-200 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {suggestion.memberCol !== null && sheet.rows.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Aperçu</p>
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-3 py-2 text-left font-semibold text-[#534AB7] whitespace-nowrap">Membre</th>
                                {suggestion.teamCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Équipe</th>}
                                {suggestion.emailCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Email</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {sheet.rows.slice(0, 6).map((row, ri) => {
                                const name = String(row[suggestion.memberCol!] ?? '').trim();
                                if (!name) return null;
                                return (
                                  <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                                    {suggestion.teamCol !== null && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{String(row[suggestion.teamCol] ?? '')}</td>}
                                    {suggestion.emailCol !== null && <td className="px-3 py-2 text-gray-400 font-mono text-[10px] whitespace-nowrap">{String(row[suggestion.emailCol] ?? '')}</td>}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">{sheet.rows.filter(r => String(r[suggestion.memberCol!] ?? '').trim()).length} membres détectés</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && suggestion && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
            <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw className="w-4 h-4" /> Modifier
            </button>
            {selectedSheets.size > 1 && (
              <button
                onClick={onConfirmMulti}
                disabled={multiImporting}
                className="flex-1 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {multiImporting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</>
                  : <><CheckCircle2 className="w-4 h-4" />Importer {selectedSheets.size} feuilles</>
                }
              </button>
            )}
            {selectedSheets.size <= 1 && (
            <>
            {suggestion.fileType === 'access_matrix' && (
              <button
                onClick={onConfirm}
                disabled={importing || mapping.memberCol === null || payload.members.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer ({payload.members.length} membres · {payload.platforms.length} plateformes)</>}
              </button>
            )}
            {suggestion.fileType === 'platform_inventory' && suggestion.nameCol !== null && (
              <button onClick={onConfirm} disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer les plateformes ({sheet?.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length ?? 0})</>}
              </button>
            )}
            {suggestion.fileType === 'access_matrix_transposed' && (
              <button onClick={onConfirm} disabled={importing || payload.members.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer matrice pivotée ({payload.members.length} membres)</>}
              </button>
            )}
            {suggestion.fileType === 'system_inventory' && suggestion.nameCol !== null && (
              <button onClick={onConfirm} disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer les systèmes ({sheet?.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length ?? 0})</>}
              </button>
            )}
            {suggestion.fileType === 'network_flow_inventory' && suggestion.sourceCol !== null && (
              <button onClick={onConfirm} disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer les flux réseau ({sheet?.rows.filter(r => String(r[suggestion.sourceCol!] ?? '').trim()).length ?? 0})</>}
              </button>
            )}
            {suggestion.fileType === 'subscription_inventory' && suggestion.nameCol !== null && (
              <button
                onClick={onConfirm}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer les abonnements ({sheet?.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length ?? 0})</>}
              </button>
            )}
            {suggestion.fileType === 'member_list' && suggestion.memberCol !== null && (
              <button
                onClick={onConfirm}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer les membres ({sheet?.rows.filter(r => String(r[suggestion.memberCol!] ?? '').trim()).length ?? 0})</>}
              </button>
            )}
            {(suggestion.fileType === 'unknown' || !suggestion.fileType) && (
              <div className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-400 text-sm text-center">Type de fichier non reconnu</div>
            )}
            </>
            )}
          </div>
        )}
        {!loading && !suggestion && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}


// Genere un email professionnel a partir du nom complet et du domaine
function generateEmail(fullName: string, domain: string): string {
  const normalized = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length === 1) return first + "@" + domain;
  return first + "." + last + "@" + domain;
}
// --- Composant principal ---
export function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawSheets, setRawSheets] = useState<RawSheet[]>([]);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({ memberCol: null, teamCol: null, emailCol: null });
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [excludedPlatformCols, setExcludedPlatformCols] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [emailDomain, setEmailDomain] = useState("");
  const [showEmailDomainModal, setShowEmailDomainModal] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<BatchPayload | { type: "member_list"; members: { full_name: string; team?: string; email?: string }[] } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, AiSuggestion | null>>({});
  const [aiLoadingSheets, setAiLoadingSheets] = useState<Set<number>>(new Set());
  const [selectedSheets, setSelectedSheets] = useState<Set<number>>(new Set());
  const [multiImporting, setMultiImporting] = useState(false);
  const [multiResult, setMultiResult] = useState<{ sheets: Array<{ name: string; result: ImportResult | null; error?: string }> } | null>(null);

  const analyzeWithAI = useCallback(async (raw: RawSheet, sheetIndex: number): Promise<AiSuggestion | null> => {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const rowsToSend = raw.allRows.slice(0, 50).map((r) => r.map((c) => String(c)));
      const suggestion = await api.import.analyze({ rawRows: rowsToSend });
      const parsed = applyAiToSheet(raw, suggestion);
      setAiSuggestion(suggestion);
      setAiSuggestions((prev) => ({ ...prev, [sheetIndex]: suggestion }));
      // Utilise l'index passé en paramètre, pas rawSheets.indexOf (stale closure)
      setSheets((prev) => {
        const next = [...prev];
        next[sheetIndex] = parsed;
        return next;
      });
      // Si prénom/nom séparés, pointer vers la colonne virtuelle _full_name ajoutée en fin de tableau
      const effectiveMemberCol = (suggestion.firstNameCol !== null && suggestion.lastNameCol !== null)
        ? parsed.headers.length - 1  // colonne virtuelle ajoutée en dernier
        : suggestion.memberCol;
      // Pour la matrice transposée, col membre = 0 (premier col de la matrice pivotée)
      const memberColFinal = suggestion.fileType === 'access_matrix_transposed' ? 0 : effectiveMemberCol;
      setMapping({ memberCol: memberColFinal, teamCol: suggestion.teamCol, emailCol: suggestion.emailCol });
      setExcludedPlatformCols(new Set());
      return suggestion;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur IA';
      setAiError(msg.includes('AWS') || msg.includes('credential') ? 'Credentials AWS non configurés.' : msg);
      return null;
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Analyse silencieuse d'une feuille (sans toucher aiLoading/aiSuggestion/mapping)
  const analyzeSheetBackground = useCallback(async (raw: RawSheet, sheetIndex: number) => {
    setAiLoadingSheets((prev) => new Set([...prev, sheetIndex]));
    try {
      const rowsToSend = raw.allRows.slice(0, 50).map((r) => r.map((c) => String(c)));
      const suggestion = await api.import.analyze({ rawRows: rowsToSend });
      const parsed = applyAiToSheet(raw, suggestion);
      setAiSuggestions((prev) => ({ ...prev, [sheetIndex]: suggestion }));
      setSheets((prev) => {
        const next = [...prev];
        next[sheetIndex] = parsed;
        return next;
      });
    } catch {
      setAiSuggestions((prev) => ({ ...prev, [sheetIndex]: null }));
    } finally {
      setAiLoadingSheets((prev) => { const n = new Set(prev); n.delete(sheetIndex); return n; });
    }
  }, []);

  const parseFile = useCallback((f: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        const raws: RawSheet[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];
          return { name, allRows: rows };
        }).filter((s) => s.allRows.some((r) => r.some((c) => String(c).trim() !== '')));

        if (raws.length === 0) {
          setParseError('Aucune feuille avec des données trouvée dans ce fichier.');
          return;
        }

        // Parsage initial simple pour affichage pendant l'analyse
        const initialParsed: ParsedSheet[] = raws.map((raw) => {
          const nonEmpty = raw.allRows.filter((r) => r.some((c) => String(c).trim() !== ''));
          const headers = (nonEmpty[0] ?? []).map(String);
          const rows = nonEmpty.slice(1).map((r) => r.map(String));
          return { name: raw.name, headers, rows };
        });

        setRawSheets(raws);
        setSheets(initialParsed);
        setFile(f);
        setAiSuggestion(null);
        setExcludedPlatformCols(new Set());

        // Choisit la feuille la plus susceptible de contenir des données utiles
        // Priorité 1 : nom de la feuille contient un mot-clé reconnu
        const byName = raws.find((s) => {
          const n = s.name.toLowerCase().replace(/[^\w]/g, '');
          return n.includes('habilitation') || n.includes('acces') || n.includes('access')
            || n.includes('droits') || n.includes('rights') || n.includes('users') || n.includes('utilisateurs')
            || n.includes('plateforme') || n.includes('platform') || n.includes('outil')
            || n.includes('abonnement') || n.includes('subscription') || n.includes('licence') || n.includes('license')
            || n.includes('membre') || n.includes('member') || n.includes('employe') || n.includes('collaborateur')
            || n.includes('systeme') || n.includes('system') || n.includes('inventaire') || n.includes('inventory');
        });
        // Priorité 2 : feuille avec le plus de colonnes (probablement la matrice)
        const byColCount = [...raws].sort((a, b) => {
          const colsA = Math.max(...a.allRows.map((r) => r.length));
          const colsB = Math.max(...b.allRows.map((r) => r.length));
          return colsB - colsA;
        })[0];
        const bestRaw = byName ?? byColCount ?? raws[0];
        const idx = raws.indexOf(bestRaw);
        setActiveSheet(idx);
        setMapping(detectColumns(initialParsed[idx].headers));
        setSelectedSheets(new Set(raws.map((_, i) => i)));
        setStep('map');
        setModalOpen(true);
        // Analyze all sheets: main for the best one, silent for the others
        raws.forEach((raw, i) => {
          if (i !== idx) analyzeSheetBackground(raw, i);
        });
        await analyzeWithAI(bestRaw, idx);
      } catch {
        setParseError('Impossible de lire ce fichier. Vérifiez qu\'il s\'agit d\'un .xlsx, .xls ou .csv valide.');
      }
    };
    reader.readAsArrayBuffer(f);
  }, [analyzeWithAI, analyzeSheetBackground]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.(xlsx|xls|csv)$/i.test(f.name)) parseFile(f);
    else setParseError('Format non supporté. Utilisez .xlsx, .xls ou .csv');
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const currentSheet = sheets[activeSheet];
  const currentRaw = rawSheets[activeSheet];

  const allPlatformCols: { h: string; i: number }[] = (() => {
    if (!currentSheet) return [];
    const reserved = new Set([mapping.memberCol, mapping.teamCol, mapping.emailCol].filter((x) => x !== null) as number[]);
    if (aiSuggestion && aiSuggestion.platformCols.length > 0) {
      return aiSuggestion.platformCols
        .filter((i) => !reserved.has(i) && i < currentSheet.headers.length)
        .map((i) => ({ h: currentSheet.headers[i], i }));
    }
    return currentSheet.headers.map((h, i) => ({ h, i })).filter(({ i }) => !reserved.has(i));
  })();

  const platformCols = allPlatformCols.filter(({ i }) => !excludedPlatformCols.has(i));

  const handleSelectSheet = useCallback(async (i: number) => {
    if (i === activeSheet) return;
    setActiveSheet(i);
    setAiSuggestion(null);
    setExcludedPlatformCols(new Set());
    setMapping(detectColumns(sheets[i]?.headers ?? []));
    await analyzeWithAI(rawSheets[i], i);
  }, [activeSheet, sheets, rawSheets, analyzeWithAI]);

  const togglePlatformCol = (i: number) => {
    setExcludedPlatformCols((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const buildPayload = (): BatchPayload => {
    if (!currentSheet || mapping.memberCol === null) return { members: [], platforms: [], access: [] };
    const levelMappings = aiSuggestion?.levelMappings;
    const memberNames = new Set<string>();
    const platformNames = new Set<string>(platformCols.map(({ h }) => h));
    const access: BatchPayload['access'] = [];

    for (const row of currentSheet.rows) {
      const name = String(row[mapping.memberCol] ?? '').trim();
      if (!name) continue;
      memberNames.add(name);
      for (const { h, i } of platformCols) {
        const level = normalizeLevel(String(row[i] ?? ''), levelMappings);
        if (level === 'none') continue;
        access.push({ memberName: name, platformName: h, level });
      }
    }

    return {
      members: [...memberNames].map((full_name) => {
        const row = currentSheet.rows.find((r) => String(r[mapping.memberCol!] ?? '').trim() === full_name);
        const email = row && mapping.emailCol !== null ? String(row[mapping.emailCol] ?? '').trim() : undefined;
        const team = row && mapping.teamCol !== null ? String(row[mapping.teamCol] ?? '').trim() : undefined;
        return { full_name, ...(email ? { email } : {}), ...(team ? { team } : {}) };
      }),
      platforms: [...platformNames].map((name) => ({ name })),
      access,
    };
  };

  const handleImport = async () => {
    // Detecter si des membres n ont pas d email
    const ft = aiSuggestion?.fileType;
    if (ft === 'access_matrix' || ft === 'access_matrix_transposed' || ft === 'member_list' || !ft) {
      let membersToCheck: { full_name: string; email?: string }[] = [];
      if (ft === 'member_list' && currentSheet && aiSuggestion) {
        const mCol = aiSuggestion.memberCol;
        const eCol = aiSuggestion.emailCol;
        if (mCol !== null) {
          membersToCheck = currentSheet.rows
            .map((r) => ({
              full_name: String(r[mCol] ?? '').trim(),
              email: eCol !== null ? String(r[eCol] ?? '').trim() || undefined : undefined,
            }))
            .filter((m) => m.full_name);
        }
      } else if (currentSheet && aiSuggestion) {
        // Read emails directly from the raw sheet using the AI-detected emailCol
        const mCol = aiSuggestion.fileType === 'access_matrix_transposed' ? 0
          : (aiSuggestion.firstNameCol !== null && aiSuggestion.lastNameCol !== null)
          ? currentSheet.headers.length - 1
          : aiSuggestion.memberCol;
        const eCol = mapping.emailCol;
        if (mCol !== null) {
          membersToCheck = currentSheet.rows
            .map((r) => ({
              full_name: String(r[mCol!] ?? '').trim(),
              email: eCol !== null ? String(r[eCol!] ?? '').trim() || undefined : undefined,
            }))
            .filter((m) => m.full_name);
        }
      } else {
        const p = buildPayload();
        membersToCheck = p.members;
      }
      const hasNoEmail = membersToCheck.some((m) => !m.email);
      if (hasNoEmail) {
        // Sauvegarder les donnees et afficher la modal domaine
        if (ft === 'member_list' && currentSheet && aiSuggestion) {
          const mCol = aiSuggestion.memberCol!;
          const tCol = aiSuggestion.teamCol;
          const eCol = aiSuggestion.emailCol;
          setPendingImportData({
            type: 'member_list',
            members: currentSheet.rows
              .map((r) => ({
                full_name: String(r[mCol] ?? '').trim(),
                team: tCol !== null ? String(r[tCol] ?? '').trim() || undefined : undefined,
                email: eCol !== null ? String(r[eCol] ?? '').trim() || undefined : undefined,
              }))
              .filter((m) => m.full_name),
          });
        } else {
          setPendingImportData(buildPayload());
        }
        setShowEmailDomainModal(true);
        return;
      }
    }
    await doImport();
  };

  const doImport = async (domainOverride?: string) => {
    setImporting(true);
    try {
      const ft = aiSuggestion?.fileType;

      if (ft === 'platform_inventory' && aiSuggestion?.nameCol !== null) {
        const rows = currentSheet?.rows ?? [];
        const nameCol = aiSuggestion!.nameCol!;
        const catCol = aiSuggestion!.categoryCol;
        const urlCol = aiSuggestion!.urlCol;
        const statCol = aiSuggestion!.statusCol;
        const platforms = rows
          .map((r) => ({
            name: String(r[nameCol] ?? '').trim(),
            category: catCol !== null ? String(r[catCol] ?? '').trim() : '',
            url: urlCol !== null ? String(r[urlCol] ?? '').trim() : '',
            status: statCol !== null ? String(r[statCol] ?? '').trim() || 'actif' : 'actif',
          }))
          .filter((p) => p.name);
        if (platforms.length === 0) throw new Error('Aucune plateforme trouvée.');
        const res = await api.import.batchPlatforms({ platforms });
        setResult({ created: { members: 0, platforms: res.created, accessRights: 0 }, skipped: { members: 0, platforms: res.skipped }, fileType: 'platform_inventory' });
        setModalOpen(false);
        setStep('done');

      } else if (ft === 'system_inventory' && aiSuggestion?.nameCol !== null) {
        const rows = currentSheet?.rows ?? [];
        const systems = rows.map((r) => ({
          name: String(r[aiSuggestion!.nameCol!] ?? '').trim(),
          ip_address: aiSuggestion!.ipCol !== null ? String(r[aiSuggestion!.ipCol!] ?? '').trim() : undefined,
          os_version: aiSuggestion!.osCol !== null ? String(r[aiSuggestion!.osCol!] ?? '').trim() : undefined,
          type: aiSuggestion!.typeCol !== null ? String(r[aiSuggestion!.typeCol!] ?? '').trim() : undefined,
          criticality: aiSuggestion!.criticalityCol !== null ? String(r[aiSuggestion!.criticalityCol!] ?? '').trim() : undefined,
          status: aiSuggestion!.statusCol !== null ? String(r[aiSuggestion!.statusCol!] ?? '').trim() : undefined,
          responsible: aiSuggestion!.responsibleCol !== null ? String(r[aiSuggestion!.responsibleCol!] ?? '').trim() : undefined,
        })).filter((s) => s.name);
        if (systems.length === 0) throw new Error('Aucun système trouvé.');
        const res = await api.import.batchSystems({ systems });
        setResult({ created: { members: 0, platforms: 0, accessRights: 0, systems: res.created }, skipped: { members: 0, platforms: 0, systems: res.skipped }, fileType: 'system_inventory' });
        setModalOpen(false); setStep('done');

      } else if (ft === 'network_flow_inventory' && aiSuggestion?.sourceCol !== null) {
        const rows = currentSheet?.rows ?? [];
        const flows = rows.map((r) => ({
          source: String(r[aiSuggestion!.sourceCol!] ?? '').trim(),
          destination: aiSuggestion!.destinationCol !== null ? String(r[aiSuggestion!.destinationCol!] ?? '').trim() : '',
          port: aiSuggestion!.portCol !== null ? String(r[aiSuggestion!.portCol!] ?? '').trim() : undefined,
          protocol: aiSuggestion!.protocolCol !== null ? String(r[aiSuggestion!.protocolCol!] ?? '').trim() : undefined,
          status: aiSuggestion!.statusCol !== null ? String(r[aiSuggestion!.statusCol!] ?? '').trim() : undefined,
          direction: aiSuggestion!.directionCol !== null ? String(r[aiSuggestion!.directionCol!] ?? '').trim() : undefined,
        })).filter((f) => f.source);
        if (flows.length === 0) throw new Error('Aucun flux trouvé.');
        const res = await api.import.batchNetworkFlows({ flows });
        setResult({ created: { members: 0, platforms: 0, accessRights: 0, flows: res.created }, skipped: { members: 0, platforms: 0 }, fileType: 'network_flow_inventory' });
        setModalOpen(false); setStep('done');

      } else if (ft === 'subscription_inventory' && aiSuggestion?.nameCol !== null) {
        const rows = currentSheet?.rows ?? [];
        const nCol = aiSuggestion!.nameCol!;
        const vCol = aiSuggestion!.vendorCol;
        const cCol = aiSuggestion!.categoryCol;
        const rCol = aiSuggestion!.renewalCol;
        const sCol = aiSuggestion!.statusCol;
        const subscriptions = rows
          .map((r) => ({
            name: String(r[nCol] ?? '').trim(),
            vendor: vCol !== null ? String(r[vCol] ?? '').trim() : undefined,
            category: cCol !== null ? String(r[cCol] ?? '').trim() : undefined,
            renewal_date: rCol !== null ? String(r[rCol] ?? '').trim() : undefined,
            status: sCol !== null ? String(r[sCol] ?? '').trim() || 'actif' : 'actif',
          }))
          .filter((s) => s.name);
        if (subscriptions.length === 0) throw new Error('Aucun abonnement trouvé.');
        const res = await api.import.batchSubscriptions({ subscriptions });
        setResult({ created: { members: 0, platforms: 0, accessRights: 0, subscriptions: res.created }, skipped: { members: 0, platforms: 0, subscriptions: res.skipped }, fileType: 'subscription_inventory' });
        setModalOpen(false);
        setStep('done');

      } else if (ft === 'member_list' && aiSuggestion?.memberCol !== null) {
        const rows = currentSheet?.rows ?? [];
        const mCol = aiSuggestion!.memberCol!;
        const tCol = aiSuggestion!.teamCol;
        const eCol = aiSuggestion!.emailCol;
        const members = rows
          .map((r) => ({
            full_name: String(r[mCol] ?? '').trim(),
            team: tCol !== null ? String(r[tCol] ?? '').trim() : undefined,
            email: eCol !== null ? String(r[eCol] ?? '').trim() : undefined,
          }))
          .filter((m) => m.full_name)
          .map((m) => ({ ...m, email: m.email || (domainOverride ? generateEmail(m.full_name, domainOverride) : undefined) }));
        if (members.length === 0) throw new Error('Aucun membre trouvé.');
        const res = await api.import.batchMembers({ members });
        setResult({ created: { members: res.created, platforms: 0, accessRights: 0 }, skipped: { members: res.skipped, platforms: 0 }, fileType: 'member_list' });
        setModalOpen(false);
        setStep('done');

      } else {
        if (mapping.memberCol === null) return;
        const data = buildPayload();
        if (domainOverride) {
          data.members = data.members.map((m) => ({ ...m, email: m.email || generateEmail(m.full_name, domainOverride) }));
        }
        if (data.members.length === 0) throw new Error('Aucun membre trouvé. Vérifiez que la colonne Membres est bien sélectionnée.');
        const res = await api.import.batch(data);
        setResult({ ...res, fileType: 'access_matrix' });
        setModalOpen(false);
        setStep('done');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erreur lors de l\'import.');
    } finally {
      setImporting(false);
    }
  };

  // Verifier les emails manquants sur toutes les feuilles selectionnees avant d'importer
  const handleImportMulti = async () => {
    let anyMissingEmail = false;
    for (const idx of Array.from(selectedSheets)) {
      const sug = aiSuggestions[idx];
      const sheet = sheets[idx];
      if (!sug || !sheet) continue;
      const ft = sug.fileType;
      if (ft !== 'access_matrix' && ft !== 'access_matrix_transposed' && ft !== 'member_list') continue;
      const mCol = ft === 'access_matrix_transposed' ? 0
        : (sug.firstNameCol !== null && sug.lastNameCol !== null) ? sheet.headers.length - 1
        : sug.memberCol;
      const eCol = sug.emailCol;
      if (mCol === null) continue;
      const hasMissing = sheet.rows.some((r) => {
        const name = String(r[mCol!] ?? '').trim();
        if (!name) return false;
        const email = eCol !== null ? String(r[eCol!] ?? '').trim() : '';
        return !email;
      });
      if (hasMissing) { anyMissingEmail = true; break; }
    }
    if (anyMissingEmail) {
      setShowEmailDomainModal(true);
      return;
    }
    await doImportMulti();
  };

  // Import toutes les feuilles selectionnees en sequence
  const doImportMulti = async (domainOverride?: string) => {
    setMultiImporting(true);
    const sheetResults: Array<{ name: string; result: ImportResult | null; error?: string }> = [];
    for (const idx of Array.from(selectedSheets).sort()) {
      const suggestion = aiSuggestions[idx] ?? null;
      const sheet = sheets[idx];
      const raw = rawSheets[idx];
      if (!suggestion || !sheet) {
        sheetResults.push({ name: raw?.name ?? 'Feuille ' + idx, result: null, error: 'Analyse non disponible' });
        continue;
      }
      try {
        const ft = suggestion.fileType;
        const rows = sheet.rows;
        // Derive mapping from AI suggestion
        const effectiveMemberCol = (suggestion.firstNameCol !== null && suggestion.lastNameCol !== null)
          ? sheet.headers.length - 1
          : suggestion.memberCol;
        const memberCol = ft === 'access_matrix_transposed' ? 0 : effectiveMemberCol;
        const teamCol = suggestion.teamCol;
        const emailCol = suggestion.emailCol;

        if (ft === 'platform_inventory' && suggestion.nameCol !== null) {
          const platforms = rows.map((r) => ({
            name: String(r[suggestion.nameCol!] ?? '').trim(),
            category: suggestion.categoryCol !== null ? String(r[suggestion.categoryCol!] ?? '').trim() : '',
            url: suggestion.urlCol !== null ? String(r[suggestion.urlCol!] ?? '').trim() : '',
            status: suggestion.statusCol !== null ? String(r[suggestion.statusCol!] ?? '').trim() || 'actif' : 'actif',
          })).filter((p) => p.name);
          if (platforms.length === 0) throw new Error('Aucune plateforme');
          const res = await api.import.batchPlatforms({ platforms });
          sheetResults.push({ name: sheet.name, result: { created: { members: 0, platforms: res.created, accessRights: 0 }, skipped: { members: 0, platforms: res.skipped }, fileType: 'platform_inventory' } });

        } else if (ft === 'system_inventory' && suggestion.nameCol !== null) {
          const systems = rows.map((r) => ({
            name: String(r[suggestion.nameCol!] ?? '').trim(),
            ip_address: suggestion.ipCol !== null ? String(r[suggestion.ipCol!] ?? '').trim() : undefined,
            os_version: suggestion.osCol !== null ? String(r[suggestion.osCol!] ?? '').trim() : undefined,
            type: suggestion.typeCol !== null ? String(r[suggestion.typeCol!] ?? '').trim() : undefined,
            criticality: suggestion.criticalityCol !== null ? String(r[suggestion.criticalityCol!] ?? '').trim() : undefined,
            status: suggestion.statusCol !== null ? String(r[suggestion.statusCol!] ?? '').trim() : undefined,
            responsible: suggestion.responsibleCol !== null ? String(r[suggestion.responsibleCol!] ?? '').trim() : undefined,
          })).filter((s) => s.name);
          if (systems.length === 0) throw new Error('Aucun système');
          const res = await api.import.batchSystems({ systems });
          sheetResults.push({ name: sheet.name, result: { created: { members: 0, platforms: 0, accessRights: 0, systems: res.created }, skipped: { members: 0, platforms: 0, systems: res.skipped }, fileType: 'system_inventory' } });

        } else if (ft === 'network_flow_inventory' && suggestion.sourceCol !== null) {
          const flows = rows.map((r) => ({
            source: String(r[suggestion.sourceCol!] ?? '').trim(),
            destination: suggestion.destinationCol !== null ? String(r[suggestion.destinationCol!] ?? '').trim() : '',
            port: suggestion.portCol !== null ? String(r[suggestion.portCol!] ?? '').trim() : undefined,
            protocol: suggestion.protocolCol !== null ? String(r[suggestion.protocolCol!] ?? '').trim() : undefined,
            status: suggestion.statusCol !== null ? String(r[suggestion.statusCol!] ?? '').trim() : undefined,
            direction: suggestion.directionCol !== null ? String(r[suggestion.directionCol!] ?? '').trim() : undefined,
          })).filter((f) => f.source);
          if (flows.length === 0) throw new Error('Aucun flux');
          const res = await api.import.batchNetworkFlows({ flows });
          sheetResults.push({ name: sheet.name, result: { created: { members: 0, platforms: 0, accessRights: 0, flows: res.created }, skipped: { members: 0, platforms: 0 }, fileType: 'network_flow_inventory' } });

        } else if (ft === 'subscription_inventory' && suggestion.nameCol !== null) {
          const subscriptions = rows.map((r) => ({
            name: String(r[suggestion.nameCol!] ?? '').trim(),
            vendor: suggestion.vendorCol !== null ? String(r[suggestion.vendorCol!] ?? '').trim() : undefined,
            category: suggestion.categoryCol !== null ? String(r[suggestion.categoryCol!] ?? '').trim() : undefined,
            renewal_date: suggestion.renewalCol !== null ? String(r[suggestion.renewalCol!] ?? '').trim() : undefined,
            status: suggestion.statusCol !== null ? String(r[suggestion.statusCol!] ?? '').trim() || 'actif' : 'actif',
          })).filter((s) => s.name);
          if (subscriptions.length === 0) throw new Error('Aucun abonnement');
          const res = await api.import.batchSubscriptions({ subscriptions });
          sheetResults.push({ name: sheet.name, result: { created: { members: 0, platforms: 0, accessRights: 0, subscriptions: res.created }, skipped: { members: 0, platforms: 0, subscriptions: res.skipped }, fileType: 'subscription_inventory' } });

        } else if (ft === 'member_list' && memberCol !== null) {
          let members = rows.map((r) => ({
            full_name: String(r[memberCol!] ?? '').trim(),
            team: teamCol !== null ? String(r[teamCol!] ?? '').trim() || undefined : undefined,
            email: emailCol !== null ? String(r[emailCol!] ?? '').trim() || undefined : undefined,
          })).filter((m) => m.full_name)
            .map((m) => ({ ...m, email: m.email || (domainOverride ? generateEmail(m.full_name, domainOverride) : undefined) }));
          if (members.length === 0) throw new Error('Aucun membre');
          const res = await api.import.batchMembers({ members });
          sheetResults.push({ name: sheet.name, result: { created: { members: res.created, platforms: 0, accessRights: 0 }, skipped: { members: res.skipped, platforms: 0 }, fileType: 'member_list' } });

        } else if ((ft === 'access_matrix' || ft === 'access_matrix_transposed') && memberCol !== null) {
          const levelMappings = suggestion.levelMappings;
          const platformColsList = sheet.headers
            .map((h, i) => ({ h, i }))
            .filter(({ i }) => i !== memberCol && i !== teamCol && i !== emailCol)
            .filter(({ i }) => (suggestion.platformCols.length > 0 ? suggestion.platformCols.includes(i) : true));
          const memberNamesSet = new Set<string>();
          const platformNamesSet = new Set<string>(platformColsList.map(({ h }) => h));
          const access: { memberName: string; platformName: string; level: 'admin' | 'rw' | 'ro' | 'req' }[] = [];
          for (const row of rows) {
            const name = String(row[memberCol!] ?? '').trim();
            if (!name) continue;
            memberNamesSet.add(name);
            for (const { h, i } of platformColsList) {
              const level = normalizeLevel(String(row[i] ?? ''), levelMappings);
              if (level === 'none') continue;
              access.push({ memberName: name, platformName: h, level });
            }
          }
          let members = [...memberNamesSet].map((full_name) => {
            const row = rows.find((r) => String(r[memberCol!] ?? '').trim() === full_name);
            const email = row && emailCol !== null ? String(row[emailCol!] ?? '').trim() || undefined : undefined;
            const team = row && teamCol !== null ? String(row[teamCol!] ?? '').trim() || undefined : undefined;
            return { full_name, ...(email ? { email } : {}), ...(team ? { team } : {}) };
          }).map((m) => ({ ...m, email: m.email || (domainOverride ? generateEmail(m.full_name, domainOverride) : undefined) }));
          if (members.length === 0) throw new Error('Aucun membre');
          const data = { members, platforms: [...platformNamesSet].map((name) => ({ name })), access };
          const res = await api.import.batch(data);
          sheetResults.push({ name: sheet.name, result: { ...res, fileType: 'access_matrix' } });
        } else {
          sheetResults.push({ name: sheet.name, result: null, error: 'Type non importable: ' + ft });
        }
      } catch (err) {
        sheetResults.push({ name: sheet.name, result: null, error: err instanceof Error ? err.message : 'Erreur' });
      }
    }
    setMultiResult({ sheets: sheetResults });
    setMultiImporting(false);
    setModalOpen(false);
    setStep('done');
  };

  const reset = () => {
    setFile(null); setRawSheets([]); setSheets([]); setActiveSheet(0);
    setMapping({ memberCol: null, teamCol: null, emailCol: null });
    setAiSuggestion(null); setAiError(null); setAiLoading(false);
    setExcludedPlatformCols(new Set()); setModalOpen(false);
    setStep('upload'); setResult(null); setParseError(null);
    setAiSuggestions({}); setAiLoadingSheets(new Set()); setSelectedSheets(new Set());
    setMultiImporting(false); setMultiResult(null);
  };

  const payload = buildPayload();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Import depuis Excel</div>
        <div style={{ fontSize: 12, color: 'oklch(52% 0.012 260)', marginTop: 2 }}>Importez membres, plateformes et droits d'accès en un seul fichier</div>
      </div>

      {parseError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10, background: 'oklch(55% 0.22 25 / 0.08)', border: '1px solid oklch(55% 0.22 25 / 0.2)' }}>
          <AlertCircle style={{ width: 18, height: 18, color: 'oklch(55% 0.22 25)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ flex: 1, fontSize: 13, color: 'oklch(55% 0.22 25)' }}>{parseError}</p>
          <button onClick={() => setParseError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'oklch(55% 0.22 25)' }}><X style={{ width: 14, height: 14 }} /></button>
        </div>
      )}

      {/* ── STEP 1 : Upload ── */}
      {step === 'upload' && (
        <>
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag}
            onDragOver={handleDrag} onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? 'oklch(42% 0.18 280)' : 'oklch(90% 0.006 260)'}`,
              borderRadius: 10, padding: '48px 40px', textAlign: 'center', transition: 'all 0.12s', cursor: 'pointer',
              background: isDragging ? 'oklch(42% 0.18 280 / 0.05)' : 'oklch(100% 0 0)',
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'oklch(42% 0.18 280 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Upload style={{ width: 24, height: 24, color: 'oklch(42% 0.18 280)' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'oklch(18% 0.02 260)', marginBottom: 4 }}>Glissez votre fichier Excel ici</p>
            <p style={{ fontSize: 12.5, color: 'oklch(52% 0.012 260)', marginBottom: 20 }}>.xlsx, .xls, .csv — n'importe quel format</p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: 'oklch(42% 0.18 280)', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <FileSpreadsheet style={{ width: 15, height: 15 }} />
              Choisir un fichier
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileInput} />
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: 'oklch(42% 0.18 280 / 0.06)', border: '1px solid oklch(42% 0.18 280 / 0.15)' }}>
            <Sparkles style={{ width: 14, height: 14, color: 'oklch(42% 0.18 280)', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'oklch(42% 0.18 280)' }}>
              <strong>Analyse IA activée</strong> — Claude détecte la structure réelle de votre fichier, ignore les titres et légendes, et comprend tout format de valeurs.
            </p>
          </div>
        </>
      )}

      {/* ── STEP 2 : Modification manuelle ── */}
      {step === 'map' && currentSheet && !modalOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'oklch(100% 0 0)', borderRadius: 10, border: '1px solid oklch(90% 0.006 260)' }}>
            <FileSpreadsheet style={{ width: 30, height: 30, color: 'oklch(62% 0.16 155)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'oklch(18% 0.02 260)' }}>{file?.name}</p>
              <p style={{ fontSize: 11, color: 'oklch(52% 0.012 260)' }}>{currentSheet.rows.length} lignes · {currentSheet.headers.length} colonnes</p>
            </div>
            <button onClick={() => setModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 500, color: 'oklch(42% 0.18 280)', background: 'oklch(42% 0.18 280 / 0.06)', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
              <Sparkles style={{ width: 11, height: 11 }} /> Voir rapport IA
            </button>
            <button onClick={reset} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X style={{ width: 14, height: 14, color: 'oklch(52% 0.012 260)' }} />
            </button>
          </div>

          {rawSheets.length > 1 && (
            <div style={{ background: 'oklch(100% 0 0)', borderRadius: 10, border: '1px solid oklch(90% 0.006 260)', padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Ouvrez le rapport IA pour sélectionner les feuilles à importer</p>
            </div>
          )}

          <div style={{ background: 'oklch(100% 0 0)', borderRadius: 10, border: '1px solid oklch(90% 0.006 260)', padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)', marginBottom: 4 }}>Mappage des colonnes</p>
            <p style={{ fontSize: 11.5, color: 'oklch(52% 0.012 260)', marginBottom: 16 }}>Corrigez les colonnes si nécessaire.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              {([
                { key: 'memberCol' as const, label: 'Colonne Membres', required: true },
                { key: 'teamCol' as const, label: 'Colonne Équipe', required: false },
                { key: 'emailCol' as const, label: 'Colonne Email', required: false },
              ] as const).map(({ key, label, required }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'oklch(52% 0.012 260)', marginBottom: 6 }}>
                    {label} {required && <span style={{ color: 'oklch(55% 0.22 25)' }}>*</span>}
                  </label>
                  <select
                    value={mapping[key] ?? -1}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: Number(e.target.value) === -1 ? null : Number(e.target.value) }))}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: 7, border: '1px solid oklch(90% 0.006 260)', fontSize: 12.5, color: 'oklch(18% 0.02 260)', background: 'oklch(100% 0 0)', outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option value={-1}>— Non défini —</option>
                    {currentSheet.headers.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {allPlatformCols.length > 0 && (
              <div style={{ padding: 12, borderRadius: 8, background: 'oklch(62% 0.16 155 / 0.06)', border: '1px solid oklch(62% 0.16 155 / 0.2)' }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: 'oklch(62% 0.16 155)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck style={{ width: 13, height: 13 }} />
                  {platformCols.length} plateforme{platformCols.length > 1 ? 's' : ''}
                  <span style={{ fontWeight: 400, color: 'oklch(52% 0.012 260)' }}>(cliquez pour exclure)</span>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allPlatformCols.map(({ h, i }) => {
                    const excluded = excludedPlatformCols.has(i);
                    return (
                      <button key={i} onClick={() => togglePlatformCol(i)}
                        style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.12s', background: excluded ? 'oklch(90% 0.006 260)' : 'oklch(62% 0.16 155 / 0.12)', color: excluded ? 'oklch(52% 0.012 260)' : 'oklch(62% 0.16 155)', textDecoration: excluded ? 'line-through' : 'none' }}>
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={reset} style={{ padding: '10px 16px', borderRadius: 7, border: '1px solid oklch(90% 0.006 260)', fontSize: 13, fontWeight: 500, color: 'oklch(52% 0.012 260)', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ChevronRight style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} /> Retour
            </button>
            {rawSheets.length > 1 && selectedSheets.size > 1 ? (
              <button
                onClick={() => handleImportMulti()}
                disabled={multiImporting || selectedSheets.size === 0}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 7, background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: multiImporting || selectedSheets.size === 0 ? 0.5 : 1 }}
              >
                {multiImporting
                  ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />Import en cours…</>
                  : <><CheckCircle2 style={{ width: 14, height: 14 }} />Importer {selectedSheets.size} feuilles sélectionnées</>
                }
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing || mapping.memberCol === null || payload.members.length === 0}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 7, background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: importing || mapping.memberCol === null || payload.members.length === 0 ? 0.5 : 1 }}
              >
                {importing
                  ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />Import en cours…</>
                  : <><CheckCircle2 style={{ width: 14, height: 14 }} />Lancer l'import ({payload.members.length} membres)</>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3 : Done (multi) ── */}
      {step === 'done' && multiResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-200 p-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1 text-center">Import terminé !</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">{multiResult.sheets.filter(s => s.result).length} feuille{multiResult.sheets.filter(s => s.result).length > 1 ? 's' : ''} importée{multiResult.sheets.filter(s => s.result).length > 1 ? 's' : ''} avec succès</p>
            <div className="space-y-2">
              {multiResult.sheets.map((s, i) => (
                <div key={i} className={"flex items-center gap-3 p-3 rounded-xl border " + (s.error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
                  {s.error
                    ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  }
                  <div className="flex-1">
                    <p className={"text-sm font-semibold " + (s.error ? "text-red-700" : "text-gray-800")}>{s.name}</p>
                    {s.error && <p className="text-xs text-red-500">{s.error}</p>}
                    {s.result && (
                      <p className="text-xs text-gray-500">
                        {s.result.created.members > 0 && s.result.created.members + ' membres '}
                        {s.result.created.platforms > 0 && s.result.created.platforms + ' plateformes '}
                        {s.result.created.accessRights > 0 && s.result.created.accessRights + ' droits '}
                        {(s.result.created.systems ?? 0) > 0 && s.result.created.systems + ' systèmes '}
                        {(s.result.created.flows ?? 0) > 0 && s.result.created.flows + ' flux '}
                        {(s.result.created.subscriptions ?? 0) > 0 && s.result.created.subscriptions + ' abonnements '}
                        créés
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Importer un autre fichier</button>
            <a href="/dashboard" className="flex-1 py-3 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] transition-colors flex items-center justify-center gap-2">Voir le tableau de bord <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      )}

      {/* ── STEP 3 : Done (single) ── */}
      {step === 'done' && result && !multiResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">Import terminé !</h3>
            <p className="text-sm text-gray-500 mb-6">Vos données sont maintenant disponibles dans l'application.</p>
            <div className={`grid gap-3 ${ ['platform_inventory','member_list','subscription_inventory','system_inventory','network_flow_inventory'].includes(result.fileType ?? '') ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {(result.fileType === 'platform_inventory'
                ? [{ label: 'Plateformes créées', value: result.created.platforms, color: '#1D9E75' }]
                : result.fileType === 'subscription_inventory'
                ? [{ label: 'Abonnements créés', value: result.created.subscriptions ?? 0, color: '#2563eb' }]
                : result.fileType === 'system_inventory'
                ? [{ label: 'Systèmes créés', value: result.created.systems ?? 0, color: '#ea580c' }]
                : result.fileType === 'network_flow_inventory'
                ? [{ label: 'Flux réseau créés', value: result.created.flows ?? 0, color: '#e11d48' }]
                : result.fileType === 'member_list'
                ? [{ label: 'Membres créés', value: result.created.members, color: '#534AB7' }]
                : [
                    { label: 'Membres créés', value: result.created.members, color: '#534AB7' },
                    { label: 'Plateformes créées', value: result.created.platforms, color: '#1D9E75' },
                    { label: 'Droits d\'accès', value: result.created.accessRights, color: '#EF9F27' },
                  ]
              ).map((s) => (
                <div key={s.label} className="rounded-xl p-4 border border-gray-100" style={{ backgroundColor: `${s.color}08` }}>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {(result.skipped.members > 0 || result.skipped.platforms > 0) && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Limite du plan atteinte
                </p>
                {result.skipped.members > 0 && <p className="text-xs text-amber-600">{result.skipped.members} membre{result.skipped.members > 1 ? 's' : ''} non importé{result.skipped.members > 1 ? 's' : ''} (quota atteint)</p>}
                {result.skipped.platforms > 0 && <p className="text-xs text-amber-600">{result.skipped.platforms} plateforme{result.skipped.platforms > 1 ? 's' : ''} non importée{result.skipped.platforms > 1 ? 's' : ''} (quota atteint)</p>}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Importer un autre fichier
            </button>
            <Link to="/dashboard" className="flex-1 py-3 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] transition-colors flex items-center justify-center gap-2">
              Voir le tableau de bord <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Modal IA ── */}
      {(step === 'map' || modalOpen) && (
        <AiModal
          open={modalOpen}
          loading={aiLoading}
          suggestion={aiSuggestion}
          error={aiError}
          sheet={currentSheet ?? null}
          rawSheet={currentRaw ?? null}
          rawSheets={rawSheets}
          activeSheet={activeSheet}
          mapping={mapping}
          platformCols={platformCols}
          allPlatformCols={allPlatformCols}
          excludedPlatformCols={excludedPlatformCols}
          payload={payload}
          importing={importing}
          onSelectSheet={handleSelectSheet}
          onTogglePlatform={togglePlatformCol}
          onConfirm={handleImport}
          onEdit={() => setModalOpen(false)}
          onClose={() => setModalOpen(false)}
          aiSuggestions={aiSuggestions}
          aiLoadingSheets={aiLoadingSheets}
          selectedSheets={selectedSheets}
          multiImporting={multiImporting}
          onToggleSheet={(i) => setSelectedSheets((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
          onSelectAll={() => setSelectedSheets(new Set(rawSheets.map((_, i) => i)))}
          onDeselectAll={() => setSelectedSheets(new Set())}
          onConfirmMulti={() => handleImportMulti()}
        />
      )}

      {/* Modal generation email */}
      {showEmailDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Emails manquants détectés</h3>
                <p className="text-xs text-gray-400">
                  {(() => {
                    const members = pendingImportData ? pendingImportData.members : [];
                    const missing = members.filter((m) => !m.email).length;
                    const total = members.length;
                    return total > 0
                      ? missing + " membre" + (missing > 1 ? "s" : "") + " sur " + total + " sans email"
                      : "Certains membres n’ont pas d’adresse email";
                  })()}
                </p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Vos collaborateurs ont-ils une adresse email professionnelle ?<br />
                <span className="text-gray-400 text-xs">Ex: <span className="font-mono bg-gray-100 px-1 rounded">prenom.nom@votreentreprise.com</span></span>
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Domaine email de l&apos;organisation
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#534AB7]/20 focus-within:border-[#534AB7]">
                  <span className="px-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 py-2.5 select-none">@</span>
                  <input
                    type="text"
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value.replace(/^@/, ""))}
                    placeholder="votreentreprise.com"
                    className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                    autoFocus
                  />
                </div>
                {emailDomain && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#534AB7]/5 border border-[#534AB7]/10">
                    <p className="text-[11px] text-gray-500 mb-1">Aperçu des emails générés :</p>
                    <div className="space-y-0.5">
                      {(pendingImportData ? pendingImportData.members : []).filter((m) => !m.email).slice(0, 3).map((m, i) => (
                        <p key={i} className="text-xs font-mono text-[#534AB7]">
                          {generateEmail(m.full_name, emailDomain)}
                        </p>
                      ))}
                      {(pendingImportData ? pendingImportData.members : []).filter((m) => !m.email).length > 3 && (
                        <p className="text-[10px] text-gray-400">
                          +{(pendingImportData ? pendingImportData.members : []).filter((m) => !m.email).length - 3} autres...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowEmailDomainModal(false); if (selectedSheets.size > 1) { doImportMulti(); } else { doImport(); } }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  Ignorer, importer sans email
                </button>
                <button
                  disabled={!emailDomain.trim() || importing}
                  onClick={() => { setShowEmailDomainModal(false); if (selectedSheets.size > 1) { doImportMulti(emailDomain.trim()); } else { doImport(emailDomain.trim()); } }}
                  className="flex-1 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-semibold hover:bg-[#3C3489] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-[#534AB7]/20"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Générer les emails
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}