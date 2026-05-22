// ═══════════════════════════════════════════
// Page Import — Excel intelligent
// ═══════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, X, ChevronRight,
  Users, ShieldCheck, GitBranch, CheckCircle2,
  AlertCircle, ArrowRight, Loader2, RefreshCw, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';

// ─── Types ───
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
  memberCol: number | null;
  teamCol: number | null;
  emailCol: number | null;
  platformCols: number[];
  levelMappings: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface ImportResult {
  created: { members: number; platforms: number; accessRights: number };
  skipped: { members: number; platforms: number };
}

interface BatchPayload {
  members: { full_name: string; email?: string; team?: string }[];
  platforms: { name: string }[];
  access: { memberName: string; platformName: string; level: 'admin' | 'rw' | 'ro' | 'req' }[];
}

// ─── Normalise un niveau d'accès ───
function normalizeLevel(
  raw: string,
  aiMappings?: Record<string, 'admin' | 'rw' | 'ro' | 'req' | 'none'>
): 'admin' | 'rw' | 'ro' | 'req' | 'none' {
  const v = raw.toLowerCase().trim();
  if (!v || v === '-') return 'none';

  // AI-provided mappings take priority (checked against original case-insensitive)
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

// ─── Détection automatique des colonnes (fallback sans IA) ───
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

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Confiance élevée',
  medium: 'Confiance moyenne',
  low: 'Confiance faible',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-red-600 bg-red-50 border-red-200',
};

// ─── Composant principal ───
export function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({ memberCol: null, teamCol: null, emailCol: null });
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Track which platform columns are excluded by the user
  const [excludedPlatformCols, setExcludedPlatformCols] = useState<Set<number>>(new Set());

  const analyzeWithAI = useCallback(async (sheet: ParsedSheet) => {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const sampleRows = sheet.rows.slice(0, 5).map((r) =>
        sheet.headers.map((_, i) => String(r[i] ?? ''))
      );
      const suggestion = await api.import.analyze({ headers: sheet.headers, sampleRows });
      setAiSuggestion(suggestion);
      setMapping({
        memberCol: suggestion.memberCol,
        teamCol: suggestion.teamCol,
        emailCol: suggestion.emailCol,
      });
      setExcludedPlatformCols(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur IA';
      if (msg.includes('ANTHROPIC_API_KEY')) {
        setAiError('Clé API Anthropic non configurée sur le serveur. Configurez ANTHROPIC_API_KEY dans vos variables d\'environnement.');
      } else {
        setAiError(msg);
      }
      // Fall back to regex detection
      setMapping(detectColumns(sheet.headers));
    } finally {
      setAiLoading(false);
    }
  }, []);

  const parseFile = useCallback((f: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed: ParsedSheet[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];
          const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
          const headers = nonEmpty[0]?.map(String) ?? [];
          const dataRows = nonEmpty.slice(1).map((r) => r.map(String));
          return { name, headers, rows: dataRows };
        }).filter((s) => s.headers.length > 0 && s.rows.length > 0);

        if (parsed.length === 0) {
          setParseError('Aucune feuille avec des données trouvée dans ce fichier.');
          return;
        }

        setSheets(parsed);
        setFile(f);
        setAiSuggestion(null);
        setExcludedPlatformCols(new Set());

        const best = parsed.find((s) => {
          const h = s.headers.join(' ').toLowerCase();
          return h.includes('nom') || h.includes('name') || h.includes('membre') || h.includes('user');
        }) ?? parsed[0];
        const idx = parsed.indexOf(best);
        setActiveSheet(idx);

        // Start with regex detection immediately, then kick off AI analysis
        setMapping(detectColumns(best.headers));
        setStep('map');
        analyzeWithAI(best);
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
    if (f && /\.(xlsx|xls|csv)$/i.test(f.name)) {
      parseFile(f);
    } else {
      setParseError('Format non supporté. Utilisez .xlsx, .xls ou .csv');
    }
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const handleSheetChange = (i: number) => {
    setActiveSheet(i);
    setAiSuggestion(null);
    setExcludedPlatformCols(new Set());
    setMapping(detectColumns(sheets[i].headers));
    analyzeWithAI(sheets[i]);
  };

  const currentSheet = sheets[activeSheet];

  // Determine platform columns: AI suggestion if available, else all non-mapped cols
  const allPlatformCols: { h: string; i: number }[] = (() => {
    if (!currentSheet) return [];
    const reserved = new Set([mapping.memberCol, mapping.teamCol, mapping.emailCol].filter((x) => x !== null) as number[]);

    if (aiSuggestion && aiSuggestion.platformCols.length > 0) {
      return aiSuggestion.platformCols
        .filter((i) => !reserved.has(i) && i < currentSheet.headers.length)
        .map((i) => ({ h: currentSheet.headers[i], i }));
    }
    return currentSheet.headers
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => !reserved.has(i));
  })();

  const platformCols = allPlatformCols.filter(({ i }) => !excludedPlatformCols.has(i));

  const togglePlatformCol = (i: number) => {
    setExcludedPlatformCols((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // Données prêtes à être envoyées
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

  const payload = step === 'preview' || step === 'done' ? buildPayload() : null;

  const handleImport = async () => {
    if (mapping.memberCol === null) return;
    setImporting(true);
    try {
      const data = buildPayload();
      if (data.members.length === 0) throw new Error('Aucun membre trouvé dans les données. Vérifiez que la colonne "Membres" est bien sélectionnée.');
      const res = await api.import.batch(data);
      setResult(res);
      setStep('done');
    } catch (err) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.details) {
            const msgs = parsed.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join('; ');
            setParseError(`Erreur de validation : ${msgs}`);
          } else {
            setParseError(err.message);
          }
        } catch {
          setParseError(err.message);
        }
      } else {
        setParseError('Erreur lors de l\'import.');
      }
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null); setSheets([]); setActiveSheet(0);
    setMapping({ memberCol: null, teamCol: null, emailCol: null });
    setAiSuggestion(null); setAiError(null); setAiLoading(false);
    setExcludedPlatformCols(new Set());
    setStep('upload'); setResult(null); setParseError(null);
  };

  const LEVEL_STYLE: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    rw: 'bg-amber-100 text-amber-700',
    ro: 'bg-blue-100 text-blue-700',
    req: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import depuis Excel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importez membres, plateformes et droits d'accès en un seul fichier</p>
      </div>

      {/* Erreur globale */}
      {parseError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{parseError}</p>
          </div>
          <button onClick={() => setParseError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Étapes */}
      {step !== 'upload' && (
        <div className="flex items-center gap-2 text-xs">
          {[
            { id: 'map', label: 'Colonnes' },
            { id: 'preview', label: 'Aperçu' },
            { id: 'done', label: 'Terminé' },
          ].map((s, i, arr) => {
            const done = (step === 'preview' && i === 0) || (step === 'done' && i <= 1);
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                  done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-400'
                }`}>{done ? '✓' : i + 1}</div>
                <span className={active ? 'text-[#534AB7] font-medium' : done ? 'text-emerald-600' : 'text-gray-400'}>{s.label}</span>
                {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
              </div>
            );
          })}
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
            <p className="text-sm text-gray-400 mb-5">.xlsx, .xls, .csv</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] transition-colors cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" />
              Choisir un fichier
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </label>
          </div>

          {/* Badge IA */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#534AB7]/5 border border-[#534AB7]/20">
            <Sparkles className="w-4 h-4 text-[#534AB7] flex-shrink-0" />
            <p className="text-xs text-[#534AB7]">
              <strong>Analyse IA activée</strong> — Claude détecte automatiquement les colonnes et normalise les valeurs d'accès, quel que soit le format de votre Excel.
            </p>
          </div>

          {/* Modèle recommandé */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">Exemples de formats supportés</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    {['Nom', 'Équipe', 'Email', 'GitHub', 'Notion', 'Cloudflare'].map((h) => (
                      <th key={h} className="border border-blue-200 px-3 py-1.5 bg-blue-100 text-blue-700 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Alice Dupont', 'IT', 'alice@co.com', 'Admin', 'RW', 'RO'],
                    ['Bob Martin', 'Dev', 'bob@co.com', 'X', '✓', ''],
                    ['Claire Sys', 'Ops', 'claire@co.com', 'Oui', '', 'Admin'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((c, j) => (
                        <td key={j} className="border border-blue-200 px-3 py-1.5 text-blue-600">{c || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-blue-600 mt-2.5">
              L'IA comprend <code className="bg-blue-100 px-1 rounded">X</code>, <code className="bg-blue-100 px-1 rounded">✓</code>, <code className="bg-blue-100 px-1 rounded">Oui</code>, <code className="bg-blue-100 px-1 rounded">Admin</code>, <code className="bg-blue-100 px-1 rounded">RW</code>, <code className="bg-blue-100 px-1 rounded">RO</code> et bien d'autres formats.
            </p>
          </div>
        </>
      )}

      {/* ── STEP 2 : Mappage ── */}
      {step === 'map' && currentSheet && (
        <div className="space-y-4">
          {/* Sélecteur de feuille */}
          {sheets.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Feuille à importer</p>
              <div className="flex gap-2 flex-wrap">
                {sheets.map((s, i) => (
                  <button key={i} onClick={() => handleSheetChange(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeSheet === i ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fichier info */}
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
            <FileSpreadsheet className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{file?.name}</p>
              <p className="text-xs text-gray-400">{currentSheet.rows.length} lignes · {currentSheet.headers.length} colonnes</p>
            </div>
            <button onClick={reset} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Bandeau IA en cours */}
          {aiLoading && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#534AB7]/5 border border-[#534AB7]/20">
              <Loader2 className="w-4 h-4 text-[#534AB7] animate-spin flex-shrink-0" />
              <p className="text-sm text-[#534AB7]">Analyse IA en cours — Claude examine vos colonnes…</p>
            </div>
          )}

          {/* Résultat IA */}
          {aiSuggestion && !aiLoading && (
            <div className={`p-4 rounded-xl border ${CONFIDENCE_COLOR[aiSuggestion.confidence]}`}>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold mb-0.5">
                    Analyse IA — {CONFIDENCE_LABEL[aiSuggestion.confidence]}
                  </p>
                  <p className="text-xs opacity-80">{aiSuggestion.notes}</p>
                  {Object.keys(aiSuggestion.levelMappings).length > 0 && (
                    <p className="text-xs opacity-70 mt-1">
                      Valeurs reconnues : {Object.entries(aiSuggestion.levelMappings)
                        .filter(([, v]) => v !== 'none')
                        .map(([k, v]) => `"${k}" → ${v.toUpperCase()}`)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Erreur IA */}
          {aiError && !aiLoading && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-700">Analyse IA indisponible</p>
                <p className="text-xs text-amber-600 mt-0.5">{aiError}</p>
                <p className="text-xs text-amber-500 mt-0.5">La détection automatique classique a été utilisée à la place.</p>
              </div>
            </div>
          )}

          {/* Mappage */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Mappage des colonnes</h3>
            <p className="text-xs text-gray-400 mb-4">
              {aiSuggestion ? 'Colonnes détectées par IA — corrigez si nécessaire.' : 'Colonnes détectées automatiquement — corrigez si nécessaire.'}
            </p>

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

            {/* Plateformes détectées */}
            {allPlatformCols.length > 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {allPlatformCols.length} plateforme{allPlatformCols.length > 1 ? 's' : ''} détectée{allPlatformCols.length > 1 ? 's' : ''}
                  <span className="text-[10px] font-normal text-emerald-600 ml-1">(cliquez pour exclure)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allPlatformCols.map(({ h, i }) => {
                    const excluded = excludedPlatformCols.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => togglePlatformCol(i)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                          excluded
                            ? 'bg-gray-100 text-gray-400 line-through'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700">
                  <strong>Aucune colonne plateforme détectée.</strong> Assurez-vous que les colonnes Membres, Équipe et Email sont bien mappées — les colonnes restantes deviennent des plateformes.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('preview')}
            disabled={mapping.memberCol === null || aiLoading}
            className="w-full py-3 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyse en cours…</> : <>Voir l'aperçu <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      )}

      {/* ── STEP 3 : Preview ── */}
      {step === 'preview' && currentSheet && payload && (
        <div className="space-y-4">
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: 'Membres', value: payload.members.length, color: '#534AB7' },
              { icon: ShieldCheck, label: 'Plateformes', value: payload.platforms.length, color: '#1D9E75' },
              { icon: GitBranch, label: 'Droits d\'accès', value: payload.access.length, color: '#EF9F27' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <p className="text-2xl font-black text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Aperçu tableau */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Aperçu (5 premières lignes)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Membre</th>
                    {mapping.teamCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-700">Équipe</th>}
                    {mapping.emailCol !== null && <th className="px-3 py-2 text-left font-semibold text-gray-700">Email</th>}
                    {platformCols.slice(0, 4).map(({ h }) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-[#534AB7]">{h}</th>
                    ))}
                    {platformCols.length > 4 && <th className="px-3 py-2 text-gray-400">+{platformCols.length - 4}</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentSheet.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-800">{String(row[mapping.memberCol!] ?? '')}</td>
                      {mapping.teamCol !== null && <td className="px-3 py-2 text-gray-500">{String(row[mapping.teamCol] ?? '')}</td>}
                      {mapping.emailCol !== null && <td className="px-3 py-2 text-gray-500">{String(row[mapping.emailCol] ?? '')}</td>}
                      {platformCols.slice(0, 4).map(({ i }) => {
                        const level = normalizeLevel(String(row[i] ?? ''), aiSuggestion?.levelMappings);
                        return (
                          <td key={i} className="px-3 py-2">
                            {level !== 'none' ? (
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_STYLE[level]}`}>{level.toUpperCase()}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {payload.members.length === 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              Aucun membre trouvé. Vérifiez que la colonne "Membres" est bien sélectionnée et que les cellules ne sont pas vides.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('map')}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" /> Modifier
            </button>
            <button onClick={handleImport} disabled={importing || payload.members.length === 0}
              className="flex-1 py-3 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</>
                : <><CheckCircle2 className="w-4 h-4" />Lancer l'import ({payload.members.length} membres)</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 : Done ── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">Import terminé !</h3>
            <p className="text-sm text-gray-500 mb-6">Vos données sont maintenant disponibles dans l'application.</p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Membres créés', value: result.created.members, color: '#534AB7' },
                { label: 'Plateformes créées', value: result.created.platforms, color: '#1D9E75' },
                { label: 'Droits d\'accès', value: result.created.accessRights, color: '#EF9F27' },
              ].map((s) => (
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
                {result.skipped.members > 0 && (
                  <p className="text-xs text-amber-600">{result.skipped.members} membre{result.skipped.members > 1 ? 's' : ''} non importé{result.skipped.members > 1 ? 's' : ''} (quota atteint)</p>
                )}
                {result.skipped.platforms > 0 && (
                  <p className="text-xs text-amber-600">{result.skipped.platforms} plateforme{result.skipped.platforms > 1 ? 's' : ''} non importée{result.skipped.platforms > 1 ? 's' : ''} (quota atteint)</p>
                )}
                <p className="text-xs text-amber-500 mt-1">Passez au plan Pro pour supprimer ces limites.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Importer un autre fichier
            </button>
            <Link to="/dashboard"
              className="flex-1 py-3 rounded-xl bg-[#534AB7] text-white text-sm font-bold hover:bg-[#3C3489] transition-colors flex items-center justify-center gap-2">
              Voir le tableau de bord <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
