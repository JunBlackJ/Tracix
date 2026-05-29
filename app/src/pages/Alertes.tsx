// ═══════════════════════════════════════════
// Page Alertes — Liste + panneau de détail
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, Sparkles, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { Alert, Platform, Member, System, NetworkFlow, Subscription } from '@/types';
import { api } from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';

interface AlertesProps {
  onResolveAlert: (id: string) => void;
  onResolveAll: (ids: string[]) => void;
  alerts: Alert[];
}

// ─── Per-type remediation config ───
const REMEDIATION: Record<string, {
  title: string;
  instruction: string;
  fields: { key: string; label: string; type: 'select' | 'textarea'; options?: { value: string; label: string }[]; placeholder?: string }[];
  // what API call to make on save; returns a thunk given (sourceId, fields)
  save: (sourceId: string, fields: Record<string, string>) => Promise<unknown>;
}> = {
  no_mfa_on_admin: {
    title: 'Activer le MFA sur la plateforme',
    instruction: 'Activez le MFA directement dans les paramètres de sécurité de la plateforme, puis confirmez ci-dessous.',
    fields: [
      { key: 'has_mfa', label: 'MFA activé', type: 'select', options: [{ value: 'true', label: 'Oui — MFA activé' }, { value: 'false', label: 'Non (inchangé)' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: MFA activé via Okta le …' },
    ],
    save: (id, f) => api.platforms.update(id, { has_mfa: f.has_mfa === 'true', notes: f.notes }),
  },
  admin_count_high: {
    title: 'Réduire le nombre d\'admins',
    instruction: 'Révoquez les droits admin des comptes concernés directement sur la plateforme, puis indiquez ci-dessous ce qui a été fait.',
    fields: [
      { key: 'notes', label: 'Ce qui a été fait', type: 'textarea', placeholder: 'Ex: Droits admin retirés pour Jean D. et Marie L. le …' },
    ],
    save: (id, f) => api.platforms.update(id, { notes: f.notes }),
  },
  member_offboarding: {
    title: 'Clôturer le compte du membre',
    instruction: 'Révoquez tous les accès de ce membre sur chaque plateforme, puis mettez à jour son statut ici.',
    fields: [
      { key: 'status', label: 'Statut du membre', type: 'select', options: [{ value: 'inactif', label: 'Inactif — accès révoqués' }, { value: 'suspendu', label: 'Suspendu — en attente' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: Offboarding complet le …' },
    ],
    save: (id, f) => api.members.update(id, { status: f.status as Member['status'], notes: f.notes }),
  },
  orphan_account: {
    title: 'Supprimer ou réassigner le compte orphelin',
    instruction: 'Supprimez le compte directement sur la plateforme ou réassignez-le à un responsable, puis mettez à jour le statut.',
    fields: [
      { key: 'status', label: 'Statut du membre', type: 'select', options: [{ value: 'inactif', label: 'Inactif — compte supprimé' }, { value: 'actif', label: 'Actif — réassigné' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: Compte supprimé le …' },
    ],
    save: (id, f) => api.members.update(id, { status: f.status as Member['status'], notes: f.notes }),
  },
  shared_account_admin: {
    title: 'Rétrograder ou supprimer les droits admin',
    instruction: 'Réduisez les droits de ce compte partagé/service à lecture seule ou révoquez l\'accès admin sur chaque plateforme.',
    fields: [
      { key: 'notes', label: 'Ce qui a été fait', type: 'textarea', placeholder: 'Ex: Droits admin retirés, remplacés par RO le …' },
    ],
    save: (id, f) => api.members.update(id, { notes: f.notes }),
  },
  access_review_overdue: {
    title: 'Effectuer la revue d\'accès',
    instruction: 'Passez en revue les accès de ce membre et mettez à jour ou révoquez les droits obsolètes.',
    fields: [
      { key: 'notes', label: 'Notes de revue', type: 'textarea', placeholder: 'Ex: Revue effectuée le … — accès confirmés / réduits' },
    ],
    save: (id, f) => api.members.update(id, { notes: f.notes }),
  },
  subscription_expiring: {
    title: 'Renouveler ou résilier l\'abonnement',
    instruction: 'Prenez une décision sur cet abonnement avant son expiration et reflétez-la ici.',
    fields: [
      { key: 'status', label: 'Décision', type: 'select', options: [{ value: 'actif', label: 'Actif — renouvellement prévu' }, { value: 'à_résilier', label: 'À résilier' }, { value: 'en_négociation', label: 'En négociation' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: Renouvellement signé le …' },
    ],
    save: (id, f) => api.subscriptions.update(id, { status: f.status as Subscription['status'], notes: f.notes }),
  },
  subscription_expired: {
    title: 'Régulariser l\'abonnement expiré',
    instruction: 'Renouvelez l\'abonnement ou marquez-le comme résilié pour mettre fin à l\'alerte.',
    fields: [
      { key: 'status', label: 'Statut', type: 'select', options: [{ value: 'actif', label: 'Actif — renouvelé' }, { value: 'expiré', label: 'Expiré — accepté' }, { value: 'à_résilier', label: 'À résilier' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: Abonnement résilié définitivement le …' },
    ],
    save: (id, f) => api.subscriptions.update(id, { status: f.status as Subscription['status'], notes: f.notes }),
  },
  system_end_of_support: {
    title: 'Planifier la migration ou mise à jour',
    instruction: 'Planifiez la migration vers une version supportée ou mettez le système en maintenance.',
    fields: [
      { key: 'status', label: 'Statut du système', type: 'select', options: [{ value: 'actif', label: 'Actif — migration planifiée' }, { value: 'maintenance', label: 'En maintenance' }, { value: 'inactif', label: 'Désactivé' }] },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: Migration vers Ubuntu 24.04 prévue le …' },
    ],
    save: (id, f) => api.systems.update(id, { status: f.status as System['status'], notes: f.notes }),
  },
  system_not_patched: {
    title: 'Appliquer les correctifs de sécurité',
    instruction: 'Appliquez les derniers patchs sur ce système, puis mettez à jour la date de dernière correction.',
    fields: [
      { key: 'last_patch_date', label: 'Date du dernier patch', type: 'select',
        options: [
          { value: new Date().toISOString().slice(0, 10), label: `Aujourd'hui — ${new Date().toLocaleDateString('fr-FR')}` },
          { value: '', label: 'Autre (précisez dans les notes)' },
        ],
      },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Ex: Patch CVE-XXXX appliqué le …' },
    ],
    save: (id, f) => api.systems.update(id, { last_patch_date: f.last_patch_date || undefined, notes: f.notes }),
  },
  flow_review_overdue: {
    title: 'Effectuer la revue du flux réseau',
    instruction: 'Vérifiez que ce flux est toujours justifié et mettez à jour son statut.',
    fields: [
      { key: 'status', label: 'Statut du flux', type: 'select', options: [{ value: 'autorisé', label: 'Autorisé — toujours justifié' }, { value: 'bloqué', label: 'Bloqué — flux fermé' }, { value: 'conditionnel', label: 'Conditionnel — restreint' }] },
    ],
    save: (id, f) => api.networkFlows.update(id, { status: f.status as NetworkFlow['status'] }),
  },
};

// ─── Revoke Modal — type-aware remediation ───
function RevokeModal({ alert, onClose, onDone }: { alert: Alert; onClose: () => void; onDone: () => void }) {
  const config = REMEDIATION[alert.type];
  const [step, setStep] = useState<'warning' | 'edit' | 'saving' | 'saved'>('warning');
  const [fields, setFields] = useState<Record<string, string>>(() => {
    if (!config) return {};
    return Object.fromEntries(config.fields.map((f) => [f.key, f.options?.[0]?.value ?? '']));
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    if (!config) { onDone(); return; }
    setSaveError(null);
    setStep('saving');
    config.save(alert.source_id, fields)
      .then(() => { setStep('saved'); onDone(); })
      .catch((err: Error) => { setSaveError(err.message || 'Erreur lors de la sauvegarde.'); setStep('edit'); });
  }

  const selectStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid oklch(85% 0.006 260)', borderRadius: '7px', fontSize: '13px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const labelStyle: React.CSSProperties = { fontSize: '11.5px', fontWeight: 600, color: 'oklch(40% 0.012 260)', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'oklch(100% 0 0)', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px oklch(0% 0 0 / 0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'oklch(55% 0.22 25 / 0.12)', display: 'grid', placeItems: 'center' }}>
              <ShieldAlert style={{ width: '14px', height: '14px', color: 'oklch(55% 0.22 25)' }} />
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>{config?.title ?? 'Traiter l\'alerte'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(52% 0.012 260)', display: 'grid', placeItems: 'center', padding: '4px' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Step 1 — Warning */}
          {step === 'warning' && (
            <>
              <div style={{ background: 'oklch(62% 0.18 52 / 0.08)', border: '1px solid oklch(62% 0.18 52 / 0.22)', borderRadius: '8px', padding: '14px 16px', display: 'flex', gap: '12px' }}>
                <ShieldAlert style={{ width: '18px', height: '18px', color: 'oklch(62% 0.18 52)', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(40% 0.14 52)', marginBottom: '6px' }}>Tracix ne modifie pas les systèmes à votre place</div>
                  <div style={{ fontSize: '12.5px', color: 'oklch(45% 0.08 52)', lineHeight: 1.7 }}>
                    {config?.instruction ?? 'Effectuez l\'action directement sur la plateforme ou le système concerné, puis confirmez ici.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button onClick={() => setStep('edit')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                  Je l'ai fait — mettre à jour Tracix
                </button>
              </div>
            </>
          )}

          {/* Step 2 — Edit form */}
          {(step === 'edit' || step === 'saving') && config && (
            <>
              <div style={{ fontSize: '12.5px', color: 'oklch(52% 0.012 260)' }}>
                Confirmez ce qui a été fait pour mettre Tracix à jour.
              </div>
              {saveError && (
                <div style={{ background: 'oklch(55% 0.22 25 / 0.08)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: 'oklch(55% 0.22 25)' }}>{saveError}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {config.fields.map((f) => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={labelStyle}>{f.label}</span>
                    {f.type === 'select' ? (
                      <select value={fields[f.key] ?? ''} onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))} style={selectStyle}>
                        {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <textarea value={fields[f.key] ?? ''} onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))} rows={3} placeholder={f.placeholder}
                        style={{ padding: '8px 10px', border: '1px solid oklch(85% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', width: '100%' }} />
                    )}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button onClick={save} disabled={step === 'saving'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: step === 'saving' ? 'wait' : 'pointer', opacity: step === 'saving' ? 0.7 : 1 }}>
                  {step === 'saving' && <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />}
                  Enregistrer
                </button>
              </div>
            </>
          )}

          {/* Step 3 — Saved */}
          {step === 'saved' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
              <CheckCircle2 style={{ width: '40px', height: '40px', color: 'oklch(62% 0.16 155)' }} />
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Mis à jour avec succès</div>
              <div style={{ fontSize: '12.5px', color: 'oklch(52% 0.012 260)', textAlign: 'center' }}>Les modifications ont été enregistrées dans Tracix.</div>
              <button onClick={onClose} style={{ padding: '7px 20px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

// ─── AI Advice Modal ───
function AdviceModal({ alert, onClose, onResolve }: { alert: Alert; onClose: () => void; onResolve: () => void }) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  function fetchAdvice() {
    setLoading(true);
    setError(null);
    api.alerts.getAdvice(alert.id)
      .then((res) => {
        setAdvice(res.advice);
        setRemaining(res.remaining);
        setLoading(false);
      })
      .catch((err: Error) => {
        const msg = err.message ?? '';
        if (msg.includes('Limite atteinte') || msg.includes('limitReached')) {
          setLimitReached(true);
        }
        setError(msg || 'Erreur lors de la génération du conseil.');
        setLoading(false);
      });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'oklch(100% 0 0)', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px oklch(0% 0 0 / 0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid oklch(90% 0.006 260)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'oklch(42% 0.18 280 / 0.12)', display: 'grid', placeItems: 'center' }}>
              <Sparkles style={{ width: '14px', height: '14px', color: 'oklch(42% 0.18 280)' }} />
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>Conseil IA</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(52% 0.012 260)', display: 'grid', placeItems: 'center', padding: '4px' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Alert context */}
        <div style={{ padding: '14px 20px', background: 'oklch(97% 0.005 260)', borderBottom: '1px solid oklch(90% 0.006 260)', fontSize: '12px', color: 'oklch(40% 0.012 260)' }}>
          <span style={{ fontWeight: 600 }}>{alert.source_label}</span>
          <span style={{ margin: '0 6px', color: 'oklch(65% 0.008 260)' }}>·</span>
          {alert.message}
        </div>

        {/* Content */}
        <div style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!advice && !loading && !error && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'oklch(52% 0.012 260)', margin: 0 }}>
                Obtenez un conseil personnalisé pour résoudre cette alerte.
              </p>
              <button onClick={fetchAdvice} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                <Sparkles style={{ width: '13px', height: '13px' }} />
                Générer un conseil
              </button>
            </div>
          )}

          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Loader2 style={{ width: '22px', height: '22px', color: 'oklch(42% 0.18 280)', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '12.5px', color: 'oklch(52% 0.012 260)', margin: 0 }}>Analyse en cours…</p>
            </div>
          )}

          {error && (
            <div style={{ background: limitReached ? 'oklch(62% 0.18 52 / 0.1)' : 'oklch(55% 0.22 25 / 0.08)', borderRadius: '8px', padding: '14px', fontSize: '12.5px', color: limitReached ? 'oklch(62% 0.18 52)' : 'oklch(55% 0.22 25)' }}>
              {error}
            </div>
          )}

          {advice && (
            <div style={{ background: 'oklch(42% 0.18 280 / 0.06)', borderRadius: '8px', padding: '14px', fontSize: '13px', color: 'oklch(18% 0.02 260)', lineHeight: 1.6, border: '1px solid oklch(42% 0.18 280 / 0.15)' }}>
              {advice}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid oklch(90% 0.006 260)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'oklch(62% 0.012 260)' }}>
            {remaining !== null && remaining >= 0
              ? `${remaining} conseil${remaining !== 1 ? 's' : ''} restant${remaining !== 1 ? 's' : ''} ce mois`
              : null}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {advice && !alert.is_resolved && (
              <button onClick={() => { onResolve(); onClose(); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(62% 0.16 155 / 0.12)', color: 'oklch(40% 0.16 155)', border: '1px solid oklch(62% 0.16 155 / 0.3)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                J'ai appliqué — Marquer comme traité
              </button>
            )}
            <button onClick={onClose} style={{ padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabFilter = 'all' | 'critical' | 'warning' | 'closed';

export function Alertes({ onResolveAlert, onResolveAll, alerts }: AlertesProps) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(isMobile ? null : (alerts[0] ?? null));
  const [adviceAlert, setAdviceAlert] = useState<Alert | null>(null);
  const [revokeAlert, setRevokeAlert] = useState<Alert | null>(null);

  const openAlerts    = alerts.filter((a) => !a.is_resolved);
  const closedAlerts  = alerts.filter((a) => a.is_resolved);
  const critiques     = alerts.filter((a) => a.severity === 'critical' && !a.is_resolved);
  const warnings      = alerts.filter((a) => a.severity === 'warning' && !a.is_resolved);

  const filtered = alerts.filter((a) => {
    if (tab === 'critical' && (a.is_resolved || a.severity !== 'critical')) return false;
    if (tab === 'warning'  && (a.is_resolved || a.severity !== 'warning'))  return false;
    if (tab === 'closed'   && !a.is_resolved) return false;
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
    if (search && !a.message.toLowerCase().includes(search.toLowerCase()) && !a.source_label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unresolvedIds = openAlerts.map((a) => a.id);

  const TABS: { id: TabFilter; label: string; count?: number }[] = [
    { id: 'all',      label: 'Toutes',    count: alerts.length },
    { id: 'critical', label: 'Critiques', count: critiques.length },
    { id: 'warning',  label: 'Élevées',   count: warnings.length },
    { id: 'closed',   label: 'Clôturées', count: closedAlerts.length },
  ];

  const sel = selectedAlert;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Topbar row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Alertes</div>
          <div style={{ fontSize: '12px', color: 'oklch(52% 0.012 260)' }}>
            {openAlerts.length} alertes ouvertes · priorité critique en tête
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/parametres?section=organisation"
            className="hidden sm:inline-flex"
            style={{ alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: 'oklch(52% 0.012 260)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>
            Configurer les règles
          </Link>
          {unresolvedIds.length > 0 && (
            <button onClick={() => onResolveAll(unresolvedIds)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
              Tout acquitter
            </button>
          )}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard label="Alertes ouvertes" value={openAlerts.length} delta={`↑ +${Math.max(0, openAlerts.length - 4)} depuis hier`} deltaColor="oklch(55% 0.22 25)" color="oklch(55% 0.22 25)" svgPath="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0" />
        <KpiCard label="Critiques" value={critiques.length} delta="Action immédiate requise" deltaColor="oklch(55% 0.22 25)" color="oklch(55% 0.22 25)" svgPath="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01" />
        <KpiCard label="En cours d'analyse" value={alerts.filter((a) => !a.is_resolved && a.severity === 'warning').length} delta="Assignées à l'équipe" deltaColor="oklch(52% 0.012 260)" color="oklch(62% 0.18 52)" svgPath="M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2" />
        <KpiCard label="Clôturées ce mois-ci" value={closedAlerts.length} delta="↑ MTTR moyen 2h14" deltaColor="oklch(62% 0.16 155)" color="oklch(62% 0.16 155)" svgPath="M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-2.99" />
      </div>

      {/* Alert list + detail panel */}
      <div style={{ background: 'oklch(100% 0 0)', border: '1px solid oklch(90% 0.006 260)', borderRadius: '10px', display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: isMobile ? undefined : '500px' }}>
        {/* Alert list column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {/* Tab bar */}
          <div className="flex gap-0.5 px-4 lg:px-5 py-3 overflow-x-auto scrollbar-none" style={{ borderBottom: '1px solid oklch(90% 0.006 260)' }}>
            {TABS.map(({ id, label, count }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-shrink-0"
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 p-3 lg:px-4 lg:py-3" style={{ borderBottom: '1px solid oklch(90% 0.006 260)' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'oklch(52% 0.012 260)', pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une alerte…"
                style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(97% 0.005 260)', color: 'oklch(18% 0.02 260)', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div className="flex gap-2">
              <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}
                className="flex-1 sm:flex-none"
                style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="all">Toutes les sévérités</option>
                <option value="critical">Critique</option>
                <option value="warning">Élevé</option>
                <option value="info">Moyen</option>
              </select>
              <select
                className="flex-1 sm:flex-none"
                style={{ padding: '7px 12px', border: '1px solid oklch(90% 0.006 260)', borderRadius: '7px', fontSize: '12.5px', background: 'oklch(100% 0 0)', color: 'oklch(18% 0.02 260)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <option>Tous les types</option>
                <option>MFA manquant</option>
                <option>Compte orphelin</option>
                <option>Revue dépassée</option>
              </select>
            </div>
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

        {/* Detail panel — desktop inline, mobile overlay */}
        {sel && !isMobile && (
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
              <button onClick={() => setAdviceAlert(sel)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(42% 0.18 280)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                <Sparkles style={{ width: '13px', height: '13px' }} />
                Conseiller IA
              </button>
              {!sel.is_resolved && (
                <button onClick={() => setRevokeAlert(sel)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 14px', background: 'oklch(55% 0.22 25 / 0.1)', color: 'oklch(55% 0.22 25)', border: '1px solid oklch(55% 0.22 25 / 0.2)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                  Traiter / Révoquer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile detail sheet */}
      {isMobile && sel && (
        <div className="fixed inset-0 z-40" onClick={() => setSelectedAlert(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'oklch(90% 0.006 260)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'oklch(18% 0.02 260)' }}>{sel.source_label}</div>
              <button onClick={() => setSelectedAlert(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 flex-wrap mb-4">
                <Pill style={sevPillStyle(sel.severity)}>{sevLabel(sel.severity)}</Pill>
                <Pill style={statusPillStyle(statusKey(sel))}>{statusLabel(sel)}</Pill>
              </div>
              <div className="space-y-2 mb-4">
                {[
                  { label: 'Module', value: sel.source_module },
                  { label: 'Type', value: TYPE_LABELS[sel.type] ?? sel.type },
                  { label: 'Message', value: sel.message },
                  { label: 'Détectée', value: new Date(sel.created_at).toLocaleString('fr-FR') },
                ].map((f, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-gray-500 min-w-[80px]">{f.label}</span>
                    <span className="text-gray-900 font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setAdviceAlert(sel)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'oklch(42% 0.18 280)' }}>
                  <Sparkles className="w-4 h-4" /> Conseiller IA
                </button>
                {!sel.is_resolved && (
                  <button onClick={() => setRevokeAlert(sel)}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-medium"
                    style={{ background: 'oklch(55% 0.22 25 / 0.1)', color: 'oklch(55% 0.22 25)', border: '1px solid oklch(55% 0.22 25 / 0.2)' }}>
                    Traiter / Révoquer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {adviceAlert && (
        <AdviceModal
          alert={adviceAlert}
          onClose={() => setAdviceAlert(null)}
          onResolve={() => { onResolveAlert(adviceAlert.id); setSelectedAlert(null); }}
        />
      )}

      {revokeAlert && (
        <RevokeModal
          alert={revokeAlert}
          onClose={() => setRevokeAlert(null)}
          onDone={() => { onResolveAlert(revokeAlert.id); setSelectedAlert(null); setRevokeAlert(null); }}
        />
      )}
    </div>
  );
}
