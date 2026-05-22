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
  fileType: 'access_matrix' | 'platform_inventory' | 'member_list' | 'unknown';
  headerRowIndex: number;
  dataEndRow: number | null;
  memberCol: number | null;
  teamCol: number | null;
  emailCol: number | null;
  platformCols: number[];
  levelMappings: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>;
  nameCol: number | null;
  categoryCol: number | null;
  urlCol: number | null;
  statusCol: number | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface ImportResult {
  created: { members: number; platforms: number; accessRights: number };
  skipped: { members: number; platforms: number };
  fileType?: 'access_matrix' | 'platform_inventory' | 'member_list' | 'unknown';
}

interface BatchPayload {
  members: { full_name: string; email?: string; team?: string }[];
  platforms: { name: string }[];
  access: { memberName: string; platformName: string; level: 'admin' | 'rw' | 'ro' | 'req' }[];
}

// ─── Construit un ParsedSheet depuis un RawSheet + suggestion IA ───
function applyAiToSheet(raw: RawSheet, ai: AiSuggestion): ParsedSheet {
  const headerRow = raw.allRows[ai.headerRowIndex] ?? [];
  const end = ai.dataEndRow ?? raw.allRows.length;
  const dataRows = raw.allRows.slice(ai.headerRowIndex + 1, end)
    .filter((r) => r.some((c) => String(c).trim() !== ''));
  return { name: raw.name, headers: headerRow.map(String), rows: dataRows.map((r) => r.map(String)) };
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
}

function AiModal({
  open, loading, suggestion, error, sheet, rawSheet,
  rawSheets, activeSheet,
  mapping, platformCols, allPlatformCols, excludedPlatformCols,
  payload, importing, onSelectSheet, onTogglePlatform, onConfirm, onEdit, onClose,
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
            {rawSheets.length > 1 ? (
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {rawSheets.map((s, i) => (
                  <button
                    key={i}
                    disabled={loading}
                    onClick={() => onSelectSheet(i)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                      activeSheet === i
                        ? 'bg-[#534AB7] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 truncate">{sheetName}</p>
            )}
          </div>
          {!loading && (
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

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
                        suggestion.fileType === 'access_matrix' ? 'bg-[#534AB7]/10 text-[#534AB7]'
                        : suggestion.fileType === 'platform_inventory' ? 'bg-emerald-100 text-emerald-700'
                        : suggestion.fileType === 'member_list' ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {suggestion.fileType === 'access_matrix' ? 'Matrice d\'habilitations'
                          : suggestion.fileType === 'platform_inventory' ? 'Inventaire de plateformes'
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
                  {suggestion.headerRowIndex > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{suggestion.headerRowIndex} ligne{suggestion.headerRowIndex > 1 ? 's' : ''} ignorée{suggestion.headerRowIndex > 1 ? 's' : ''}</p>
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
              <button
                onClick={onConfirm}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</> : <><CheckCircle2 className="w-4 h-4" />Importer les plateformes ({sheet?.rows.filter(r => String(r[suggestion.nameCol!] ?? '').trim()).length ?? 0})</>}
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

// ─── Composant principal ───
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

  const analyzeWithAI = useCallback(async (raw: RawSheet, sheetIndex: number): Promise<AiSuggestion | null> => {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const rowsToSend = raw.allRows.slice(0, 50).map((r) => r.map((c) => String(c)));
      const suggestion = await api.import.analyze({ rawRows: rowsToSend });
      const parsed = applyAiToSheet(raw, suggestion);
      setAiSuggestion(suggestion);
      // Utilise l'index passé en paramètre, pas rawSheets.indexOf (stale closure)
      setSheets((prev) => {
        const next = [...prev];
        next[sheetIndex] = parsed;
        return next;
      });
      setMapping({ memberCol: suggestion.memberCol, teamCol: suggestion.teamCol, emailCol: suggestion.emailCol });
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

        // Choisit la feuille la plus susceptible d'être la matrice d'habilitation
        // Priorité 1 : nom de la feuille contient un mot-clé
        const byName = raws.find((s) => {
          const n = s.name.toLowerCase().replace(/[^\w]/g, '');
          return n.includes('habilitation') || n.includes('acces') || n.includes('access')
            || n.includes('droits') || n.includes('rights') || n.includes('users') || n.includes('utilisateurs');
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
        setStep('map');
        setModalOpen(true);
        await analyzeWithAI(bestRaw, idx);
      } catch {
        setParseError('Impossible de lire ce fichier. Vérifiez qu\'il s\'agit d\'un .xlsx, .xls ou .csv valide.');
      }
    };
    reader.readAsArrayBuffer(f);
  }, [analyzeWithAI]);

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
          .filter((m) => m.full_name);
        if (members.length === 0) throw new Error('Aucun membre trouvé.');
        const res = await api.import.batchMembers({ members });
        setResult({ created: { members: res.created, platforms: 0, accessRights: 0 }, skipped: { members: res.skipped, platforms: 0 }, fileType: 'member_list' });
        setModalOpen(false);
        setStep('done');

      } else {
        if (mapping.memberCol === null) return;
        const data = buildPayload();
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

  const reset = () => {
    setFile(null); setRawSheets([]); setSheets([]); setActiveSheet(0);
    setMapping({ memberCol: null, teamCol: null, emailCol: null });
    setAiSuggestion(null); setAiError(null); setAiLoading(false);
    setExcludedPlatformCols(new Set()); setModalOpen(false);
    setStep('upload'); setResult(null); setParseError(null);
  };

  const payload = buildPayload();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import depuis Excel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importez membres, plateformes et droits d'accès en un seul fichier</p>
      </div>

      {parseError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-red-700">{parseError}</p>
          <button onClick={() => setParseError(null)}><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* ── STEP 1 : Upload ── */}
      {step === 'upload' && (
        <>
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag}
            onDragOver={handleDrag} onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-[#534AB7] bg-[#534AB7]/5' : 'border-gray-300 bg-white hover:border-[#534AB7]/40'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-[#534AB7]/10 flex items-center justify-center mx-auto mb-5">
              <Upload className="w-7 h-7 text-[#534AB7]" />
            </div>
            <p className="text-base font-semibold text-gray-800 mb-1">Glissez votre fichier Excel ici</p>
            <p className="text-sm text-gray-400 mb-5">.xlsx, .xls, .csv — n'importe quel format</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] transition-colors cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" />
              Choisir un fichier
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </label>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#534AB7]/5 border border-[#534AB7]/20">
            <Sparkles className="w-4 h-4 text-[#534AB7] flex-shrink-0" />
            <p className="text-xs text-[#534AB7]">
              <strong>Analyse IA activée</strong> — Claude détecte la structure réelle de votre fichier, ignore les titres et légendes, et comprend tout format de valeurs.
            </p>
          </div>
        </>
      )}

      {/* ── STEP 2 : Modification manuelle ── */}
      {step === 'map' && currentSheet && !modalOpen && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
            <FileSpreadsheet className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{file?.name}</p>
              <p className="text-xs text-gray-400">{currentSheet.rows.length} lignes · {currentSheet.headers.length} colonnes</p>
            </div>
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#534AB7] bg-[#534AB7]/5 hover:bg-[#534AB7]/10 rounded-lg transition-colors">
              <Sparkles className="w-3 h-3" /> Voir rapport IA
            </button>
            <button onClick={reset} className="p-1.5 hover:bg-gray-100 rounded-lg ml-1">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Sélecteur de feuille */}
          {rawSheets.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Feuille à importer</p>
              <div className="flex gap-2 flex-wrap">
                {rawSheets.map((s, i) => (
                  <button key={i} onClick={() => setActiveSheet(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeSheet === i ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Mappage des colonnes</h3>
            <p className="text-xs text-gray-400 mb-4">Corrigez les colonnes si nécessaire.</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              {([
                { key: 'memberCol' as const, label: 'Colonne Membres', required: true },
                { key: 'teamCol' as const, label: 'Colonne Équipe', required: false },
                { key: 'emailCol' as const, label: 'Colonne Email', required: false },
              ] as const).map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={mapping[key] ?? -1}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: Number(e.target.value) === -1 ? null : Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:border-[#534AB7] outline-none"
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
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {platformCols.length} plateforme{platformCols.length > 1 ? 's' : ''}
                  <span className="font-normal text-emerald-600">(cliquez pour exclure)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allPlatformCols.map(({ h, i }) => {
                    const excluded = excludedPlatformCols.has(i);
                    return (
                      <button key={i} onClick={() => togglePlatformCol(i)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                          excluded ? 'bg-gray-100 text-gray-400 line-through' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}>
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Retour
            </button>
            <button
              onClick={handleImport}
              disabled={importing || mapping.memberCol === null || payload.members.length === 0}
              className="flex-1 py-3 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</>
                : <><CheckCircle2 className="w-4 h-4" />Lancer l'import ({payload.members.length} membres)</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 : Done ── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">Import terminé !</h3>
            <p className="text-sm text-gray-500 mb-6">Vos données sont maintenant disponibles dans l'application.</p>
            <div className={`grid gap-3 ${result.fileType === 'platform_inventory' || result.fileType === 'member_list' ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {(result.fileType === 'platform_inventory'
                ? [{ label: 'Plateformes créées', value: result.created.platforms, color: '#1D9E75' }]
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
        />
      )}
    </div>
  );
}
