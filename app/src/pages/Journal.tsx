// ═══════════════════════════════════════════
// Page Journal d'audit
// ═══════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AuditTrail } from '@/types';

interface JournalProps {
  auditTrail: AuditTrail[];
}

const PAGE_SIZE = 20;

function catPill(action: string): React.ReactNode {
  const a = action.toLowerCase();
  if (a.includes('auth') || a.includes('login') || a.includes('mfa') || a.includes('connexion') || a.includes('password')) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(70% 0.14 88 / 0.1)', color: 'oklch(70% 0.14 88)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />Authentification</span>;
  }
  if (a.includes('security') || a.includes('sécurité') || a.includes('détect') || a.includes('alerte') || a.includes('scan') || a.includes('revoc')) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(62% 0.18 52 / 0.1)', color: 'oklch(62% 0.18 52)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />Sécurité</span>;
  }
  if (a.includes('admin') || a.includes('creat') || a.includes('suppres') || a.includes('modif') || a.includes('policy') || a.includes('role')) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(42% 0.12 280 / 0.12)', color: 'oklch(42% 0.18 280)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />Administration</span>;
  }
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(42% 0.12 280 / 0.12)', color: 'oklch(42% 0.18 280)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />Accès</span>;
}

function resultPill(result?: string): React.ReactNode {
  if (!result || result === 'success' || result === 'ok') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(62% 0.16 155 / 0.1)', color: 'oklch(62% 0.16 155)' }}>Succès</span>;
  }
  if (result === 'fail' || result === 'error') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(55% 0.22 25 / 0.1)', color: 'oklch(55% 0.22 25)' }}>Échec</span>;
  }
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'oklch(62% 0.18 52 / 0.1)', color: 'oklch(62% 0.18 52)' }}>Refusé</span>;
}

export function Journal({ auditTrail: initialTrail }: JournalProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [entries, setEntries] = useState<AuditTrail[]>(initialTrail);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.auditTrail.list({ page: 1, limit: 200 }).then((res) => {
      setEntries(res.data);
    }).catch(() => {
      setEntries(initialTrail);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toDateString();
  const todayCount = entries.filter((e) => new Date(e.created_at).toDateString() === today).length;
  const failCount = entries.filter((e) => e.action.toLowerCase().includes('fail') || e.action.toLowerCase().includes('échec')).length;
  const adminCount = entries.filter((e) => e.target_type?.toLowerCase().includes('admin') || e.action.toLowerCase().includes('admin')).length;

  const filtered = entries.filter((e) => {
    if (search && !e.actor.toLowerCase().includes(search.toLowerCase()) && !e.action.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && new Date(e.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(e.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportCsv = () => {
    const escCsv = (v: string) => /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    const rows = filtered.map(e => [
      new Date(e.created_at).toLocaleString('fr-FR'),
      escCsv(e.actor),
      escCsv(e.action),
      escCsv(e.target_label),
      e.ip_address || '—',
      'Succès',
    ]);
    const csv = [['Horodatage', 'Acteur', 'Action', 'Ressource cible', 'IP source', 'Résultat'], ...rows]
      .map(r => r.join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'journal-audit.csv';
    a.click();
  };

  const inputStyle: React.CSSProperties = {
    background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 7, padding: '7px 10px',
    fontFamily: 'inherit', fontSize: 12.5, color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer',
  };
  const thStyle: React.CSSProperties = {
    textAlign: 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'oklch(52% 0.012 260)', padding: '10px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = { padding: '12px 20px', verticalAlign: 'middle' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Topbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Journal d'audit</div>
          <div style={{ fontSize: 12, color: 'oklch(52% 0.012 260)' }}>Traçabilité de toutes les actions</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)' }}>
          <Download size={13} /> Exporter CSV
        </button>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)' }}>
          <FileText size={13} /> Exporter PDF
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ background: 'oklch(97% 0.005 260 / 0.96)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 7, padding: '7px 12px' }}>
          <Search size={14} style={{ color: 'oklch(52% 0.012 260)', flexShrink: 0 }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un acteur, une action..." style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: 'oklch(18% 0.02 260)', width: '100%' }} />
        </div>
        <span style={{ fontSize: 11, color: 'oklch(52% 0.012 260)', whiteSpace: 'nowrap' }}>Depuis</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
        <span style={{ fontSize: 11, color: 'oklch(52% 0.012 260)', whiteSpace: 'nowrap' }}>Jusqu'au</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={inputStyle}>
          <option value="">Catégorie : Toutes</option>
          <option value="auth">Authentification</option>
          <option value="access">Accès</option>
          <option value="admin">Administration</option>
          <option value="security">Sécurité</option>
        </select>
        <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} style={inputStyle}>
          <option value="">Résultat : Tous</option>
          <option value="success">Succès</option>
          <option value="fail">Échec</option>
          <option value="deny">Refusé</option>
        </select>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none' }}>
          Appliquer
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Entrées aujourd'hui", value: todayCount, color: 'oklch(42% 0.18 280)' },
          { label: "Échecs d'authentification", value: failCount, color: 'oklch(55% 0.22 25)' },
          { label: 'Actions admin', value: adminCount, color: 'oklch(18% 0.02 260)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: 'oklch(52% 0.012 260)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em', color: s.color }}>{s.value.toLocaleString('fr-FR')}</div>
          </div>
        ))}
      </div>

      {/* Audit log table */}
      <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Entrées du journal</span>
          <span style={{ fontSize: 11, color: 'oklch(52% 0.012 260)' }}>— {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pageItems.map((entry) => (
              <div key={entry.id} style={{ padding: '14px 16px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'oklch(52% 0.012 260)' }}>
                    {new Date(entry.created_at).toLocaleString('fr-FR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {resultPill(
                    entry.action.toLowerCase().includes('fail') || entry.action.toLowerCase().includes('échec') || entry.action.toLowerCase().includes('error')
                      ? 'fail'
                      : entry.action.toLowerCase().includes('deny') || entry.action.toLowerCase().includes('refus') || entry.action.toLowerCase().includes('reject')
                      ? 'deny'
                      : 'success'
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'oklch(18% 0.02 260)', marginBottom: 4 }}>{entry.actor}</div>
                <div style={{ fontSize: 12, color: 'oklch(42% 0.012 260)' }}>{entry.action}</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'oklch(52% 0.012 260)', fontSize: 13 }}>
                Aucune entrée trouvée
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Horodatage', 'Acteur', 'Catégorie', 'Action', 'Ressource cible', 'IP source', 'Résultat'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid oklch(90% 0.006 260)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(97% 0.005 260)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'oklch(52% 0.012 260)' }}>
                      {new Date(entry.created_at).toLocaleString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{entry.actor}</span>
                        <span style={{ fontSize: 10.5, color: 'oklch(52% 0.012 260)' }}>{entry.target_type || 'Utilisateur'}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{catPill(entry.action)}</td>
                    <td style={{ ...tdStyle, color: 'oklch(18% 0.02 260)' }}>{entry.action}</td>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'oklch(52% 0.012 260)' }}>{entry.target_label}</td>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'oklch(52% 0.012 260)' }}>{entry.ip_address || '—'}</td>
                    <td style={tdStyle}>{resultPill(
                      entry.action.toLowerCase().includes('fail') || entry.action.toLowerCase().includes('échec') || entry.action.toLowerCase().includes('error')
                        ? 'fail'
                        : entry.action.toLowerCase().includes('deny') || entry.action.toLowerCase().includes('refus') || entry.action.toLowerCase().includes('reject')
                        ? 'deny'
                        : 'success'
                    )}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'oklch(52% 0.012 260)', fontSize: 13 }}>
                      Aucune entrée trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid oklch(90% 0.006 260)', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'oklch(52% 0.012 260)' }}>
            Affichage de {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length.toLocaleString('fr-FR')} entrées
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <button disabled={safePage === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid oklch(90% 0.006 260)', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', cursor: safePage === 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, opacity: safePage === 1 ? 0.4 : 1 }}>
              &lt; Précédent
            </button>
            <span style={{ fontSize: 12, color: 'oklch(52% 0.012 260)', padding: '0 4px' }}>Page {safePage} sur {totalPages}</span>
            <button disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid oklch(90% 0.006 260)', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', cursor: safePage === totalPages ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, opacity: safePage === totalPages ? 0.4 : 1 }}>
              Suivant &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
