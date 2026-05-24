// ═══════════════════════════════════════════
// Page Alertes — Liste + panneau de détail
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Alert } from '@/types';

interface AlertesProps {
  onResolveAlert: (id: string) => void;
  onResolveAll: (ids: string[]) => void;
  alerts: Alert[];
}

// ─── Helpers ───
function sevColor(sev: string): string {
  if (sev === 'critical') return 'oklch(55% 0.22 25)';
  if (sev === 'warning')  return 'oklch(62% 0.18 52)';
  return 'oklch(62% 0.16 155)';
}

function sevPillStyle(sev: string): React.CSSProperties {
  const c = sevColor(sev);
  const bg = sev === 'critical' ? 'oklch(55% 0.22 25 / 0.1)' : sev === 'warning' ? 'oklch(62% 0.18 52 / 0.1)' : 'oklch(62% 0.16 155 / 0.1)';
  return { background: bg, color: c };
}

function statusPillStyle(status: string): React.CSSProperties {
  if (status === 'open')   return { background: 'oklch(55% 0.22 25 / 0.08)',  color: 'oklch(55% 0.22 25)' };
  if (status === 'review') return { background: 'oklch(62% 0.18 52 / 0.08)', color: 'oklch(62% 0.18 52)' };
  return { background: 'oklch(62% 0.16 155 / 0.08)', color: 'oklch(62% 0.16 155)' };
}

function statusLabel(a: Alert): string {
  if (a.is_resolved) return 'Clôturée';
  return 'Ouverte';
}

function statusKey(a: Alert): string {
  if (a.is_resolved) return 'closed';
  return 'open';
}

function sevLabel(sev: string): string {
  if (sev === 'critical') return 'Critique';
  if (sev === 'warning')  return 'Élevé';
  return 'Moyen';
}

function Pill({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', ...style }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {children}
    </span>
  );
}

// ─── KPI card (mockup style: 3px top bar, icon top-right at 0.12 opacity) ───
function KpiCard({ label, value, delta, deltaColor, color, svgPath }: {
  label: string; value: string | number; delta: string; deltaColor: string; color: string; svgPath: string;
}) {
  return (
    <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color, borderRadius: '10px 10px 0 0' }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '8px', background: color, opacity: 0.12 }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
          <path d={svgPath} />
        </svg>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1, fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: 'oklch(18% 0.02 260)' }}>{value}</div>
      <div style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", color: deltaColor }}>{delta}</div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  access_review_overdue: 'Revue dépassée',
  admin_count_high: "Trop d'Admin",
  member_offboarding: 'Offboarding',
  orphan_account: 'Compte orphelin',
  no_mfa_on_admin: 'MFA manquant',
  shared_account_admin: 'Compte partagé Admin',
  subscription_expiring: 'Renouvellement proche',
  subscription_expired: 'Abonnement expiré',
  system_end_of_support: 'Fin de support',
  system_not_patched: 'Patch manquant',
  flow_review_overdue: 'Revue flux dépassée',
};

type TabFilter = 'all' | 'open' | 'review' | 'closed';

export function Alertes({ onResolveAlert, onResolveAll, alerts }: AlertesProps) {
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(alerts[0] ?? null);

  const openAlerts    = alerts.filter((a) => !a.is_resolved);
  const closedAlerts  = alerts.filter((a) => a.is_resolved);
  const critiques     = alerts.filter((a) => a.severity === 'critical' && !a.is_resolved);

  const filtered = alerts.filter((a) => {
    if (tab === 'open'   && a.is_resolved) return false;
    if (tab === 'review' && (a.is_resolved || a.severity !== 'warning')) return false;
    if (tab === 'closed' && !a.is_resolved) return false;
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
    if (search && !a.message.toLowerCase().includes(search.toLowerCase()) && !a.source_label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unresolvedIds = openAlerts.map((a) => a.id);

  const TABS: { id: TabFilter; label: string; count?: number }[] = [
    { id: 'all',    label: 'Toutes',    count: alerts.length },
    { id: 'open',   label: 'Ouvertes',  count: openAlerts.length },
    { id: 'review', label: 'En cours',  count: alerts.filter((a) => !a.is_resolved && a.severity === 'warning').length },
    { id: 'closed', label: 'Clôturées' },
  ];

  const sel = selectedAlert;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Topbar row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Alertes</div>
          <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
            {openAlerts.length} alertes ouvertes · priorité critique en tête
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
            Configurer les règles
          </button>
          {unresolvedIds.length > 0 && (
            <button onClick={() => onResolveAll(unresolvedIds)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
              Tout acquitter
            </button>
          )}
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        <KpiCard label="Alertes ouvertes" value={openAlerts.length} delta={`↑ +${Math.max(0, openAlerts.length - 4)} depuis hier`} deltaColor="oklch(55% 0.22 25)" color="oklch(55% 0.22 25)" svgPath="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0" />
        <KpiCard label="Critiques" value={critiques.length} delta="Action immédiate requise" deltaColor="oklch(55% 0.22 25)" color="oklch(55% 0.22 25)" svgPath="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01" />
        <KpiCard label="En cours d'analyse" value={alerts.filter((a) => !a.is_resolved && a.severity === 'warning').length} delta="Assignées à l'équipe" deltaColor="oklch(52% 0.012 260)" color="oklch(62% 0.18 52)" svgPath="M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2" />
        <KpiCard label="Clôturées ce mois-ci" value={closedAlerts.length} delta="↑ MTTR moyen 2h14" deltaColor="oklch(62% 0.16 155)" color="oklch(62% 0.16 155)" svgPath="M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-2.99" />
      </div>

      {/* Alert list + detail panel */}
      <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: '500px' }}>
        {/* Alert list column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '2px', padding: '12px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
            {TABS.map(({ id, label, count }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: tab === id ? 600 : 500, cursor: 'pointer', color: tab === id ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)', background: tab === id ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'all 0.12s' }}>
                {label}
                {count != null && (
                  <span style={{ fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", fontSize: '10.5px', marginLeft: '2px', background: tab === id ? 'oklch(42% 0.18 280 / 0.2)' : 'oklch(90% 0.006 260)', padding: '1px 5px', borderRadius: '999px', color: tab === id ? 'oklch(42% 0.18 280)' : 'oklch(52% 0.012 260)' }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid oklch(90% 0.006 260)', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'oklch(52% 0.012 260)', pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une alerte…"
                style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(97% 0.005 260)', color: 'oklch(18% 0.02 260)', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value="all">Toutes les sévérités</option>
              <option value="critical">Critique</option>
              <option value="warning">Élevé</option>
              <option value="info">Moyen</option>
            </select>
            <select style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <option>Tous les types</option>
              <option>MFA manquant</option>
              <option>Compte orphelin</option>
              <option>Revue dépassée</option>
            </select>
          </div>

          {/* Alert rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map((a) => {
              const isSelected = sel?.id === a.id;
              return (
                <div key={a.id} onClick={() => setSelectedAlert(a)}
                  style={{ display: 'flex', gap: '16px', padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)', cursor: 'pointer', alignItems: 'flex-start', background: isSelected ? 'oklch(42% 0.18 280 / 0.12)' : 'transparent', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'oklch(97% 0.005 260)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: '3px', borderRadius: '999px', alignSelf: 'stretch', flexShrink: 0, minHeight: '40px', background: sevColor(a.severity) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(18% 0.02 260)', lineHeight: 1.4 }}>{a.source_label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'oklch(52% 0.012 260)' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'oklch(42% 0.18 280 / 0.12)', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 700, color: 'oklch(42% 0.18 280)', flexShrink: 0 }}>
                          {a.source_label.slice(0, 2).toUpperCase()}
                        </span>
                        {a.source_label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', background: 'oklch(97% 0.005 260)', padding: '2px 7px', borderRadius: '4px', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace" }}>
                        {a.source_module}
                      </span>
                      <span style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace" }}>
                        {new Date(a.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <Pill style={sevPillStyle(a.severity)}>{sevLabel(a.severity)}</Pill>
                    <Pill style={statusPillStyle(statusKey(a))}>{statusLabel(a)}</Pill>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'oklch(52% 0.012 260)', fontSize: '13px' }}>
                Aucune alerte
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {sel && (
          <div style={{ width: '360px', flexShrink: 0, borderLeft: '1px solid oklch(90% 0.006 260)', background: 'oklch(100% 0 0)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'oklch(18% 0.02 260)', lineHeight: 1.4, marginBottom: '12px' }}>{sel.source_label}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Pill style={sevPillStyle(sel.severity)}>{sevLabel(sel.severity)}</Pill>
                <Pill style={statusPillStyle(statusKey(sel))}>{statusLabel(sel)}</Pill>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', marginBottom: '12px' }}>Détails</div>
              {[
                { label: 'Module', value: sel.source_module },
                { label: 'Type', value: TYPE_LABELS[sel.type] ?? sel.type },
                { label: 'Message', value: sel.message },
                { label: 'Détectée', value: new Date(sel.created_at).toLocaleString('fr-FR'), mono: true },
                sel.is_resolved && { label: 'Résolue', value: new Date(sel.resolved_at).toLocaleString('fr-FR'), mono: true },
                sel.resolved_by && { label: 'Par', value: sel.resolved_by },
              ].filter(Boolean).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', fontSize: '12.5px' }}>
                  <span style={{ color: 'oklch(52% 0.012 260)', minWidth: '100px', flexShrink: 0 }}>{(f as { label: string }).label}</span>
                  <span style={{ color: 'oklch(18% 0.02 260)', fontWeight: 500, fontFamily: (f as { mono?: boolean }).mono ? "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace" : 'inherit', fontSize: (f as { mono?: boolean }).mono ? '11.5px' : '12.5px' }}>{(f as { value: string }).value}</span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(52% 0.012 260)', marginBottom: '12px' }}>Chronologie</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { color: sevColor(sel.severity), text: 'Alerte déclenchée', time: new Date(sel.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), last: !sel.is_resolved },
                  { color: 'oklch(62% 0.18 52)', text: 'Notification envoyée à l\'équipe sécurité', time: new Date(new Date(sel.created_at).getTime() + 2000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), last: false },
                  sel.is_resolved
                    ? { color: 'oklch(62% 0.16 155)', text: `Résolue${sel.resolved_by ? ` par ${sel.resolved_by}` : ''}`, time: sel.resolved_at ? new Date(sel.resolved_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—', last: true }
                    : { color: 'oklch(52% 0.012 260)', text: 'En attente de traitement', time: '', last: true },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', paddingBottom: item.last ? 0 : '14px', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: '4px' }} />
                      {!item.last && <div style={{ width: '1px', flex: 1, background: 'oklch(90% 0.006 260)', marginTop: '4px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'oklch(18% 0.02 260)', lineHeight: 1.5 }}>{item.text}</div>
                      {item.time && <div style={{ fontSize: '11px', color: 'oklch(52% 0.012 260)', fontFamily: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace", marginTop: '2px' }}>{item.time}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                Assigner à un analyste
              </button>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                Ajouter un commentaire
              </button>
              {!sel.is_resolved && (
                <button onClick={() => { onResolveAlert(sel.id); setSelectedAlert(null); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(55% 0.22 25 / 0.1)', color: 'oklch(55% 0.22 25)', border: '1px solid oklch(55% 0.22 25 / 0.2)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                  Révoquer les accès
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
