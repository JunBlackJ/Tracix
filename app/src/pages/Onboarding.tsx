// ═══════════════════════════════════════════
// Onboarding — Prise en main Tracix (dark mode)
// ═══════════════════════════════════════════

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Organization } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface OnboardingProps {
  organization: Organization;
  onComplete: (org: Organization) => void;
}

const STEPS = [
  { label: 'Bienvenue',        sub: 'Personnaliser votre profil' },
  { label: 'Organisation',     sub: 'Nom, secteur, objectif' },
  { label: 'Plateformes',      sub: 'Vos services à surveiller' },
  { label: "Inviter l'équipe", sub: 'Emails et rôles' },
  { label: 'Alertes',          sub: 'Notifications et seuils' },
  { label: 'Passer à Pro',     sub: 'Import Excel, modules avancés' },
];
const TOTAL = STEPS.length;

const OBJECTIVES = [
  { key: 'access',   title: 'Gestion des accès',    sub: 'Centraliser les droits membres et plateformes', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  { key: 'security', title: 'Sécurité & conformité', sub: 'Réduire les risques, auditer, reporter',        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { key: 'risk',     title: 'Score de risque',        sub: 'Surveiller et scorer les utilisateurs à risque', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { key: 'audit',    title: 'Audit & rapports',       sub: "Journal d'activité et rapports conformité",    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8' },
];

const PLATFORMS = [
  { key: 'aws',    label: 'AWS IAM',                sub: 'Rôles, politiques, groupes',     mono: 'AW', color: '#6366F1' },
  { key: 'azure',  label: 'Azure Active Directory', sub: 'Utilisateurs, groupes Entra ID', mono: 'AZ', color: '#3B82F6' },
  { key: 'github', label: 'GitHub',                 sub: 'Organisations, équipes, dépôts', mono: 'GH', color: '#1D9E75' },
  { key: 'google', label: 'Google Workspace',       sub: 'Comptes, groupes, Drive',        mono: 'GC', color: '#F59E0B' },
  { key: 'okta',   label: 'Okta',                   sub: 'SSO, applications, groupes',     mono: 'OK', color: '#EC4899' },
  { key: 'slack',  label: 'Slack',                  sub: 'Espaces de travail, canaux',     mono: 'SL', color: '#8B5CF6' },
  { key: 'jira',   label: 'Jira / Confluence',      sub: 'Projets, accès Atlassian',       mono: 'JI', color: '#EF4444' },
  { key: 'other',  label: 'Autre (personnalisé)',    sub: 'Créez manuellement dans Tracix', mono: '+',  color: '#6B7280' },
];

const ALERT_OPTIONS = [
  { key: 'risk_critical',  label: 'Comptes avec score de risque Critique',   sub: "Alerte immédiate dès qu'un membre passe en zone rouge", defaultChecked: true },
  { key: 'overdue_access', label: "Droits d'accès expirés non révoqués",      sub: 'Rapport hebdomadaire des habilitations en dépassement', defaultChecked: true },
  { key: 'no_mfa',         label: 'Plateformes sans MFA détectées',           sub: "Notification dès qu'une plateforme admin n'a pas le MFA", defaultChecked: true },
  { key: 'sub_expiring',   label: 'Abonnements expirant dans 30 jours',       sub: 'Rappel de renouvellement avant expiration', defaultChecked: false },
  { key: 'daily_summary',  label: "Résumé quotidien de l'activité",           sub: 'Synthèse des événements des dernières 24 h', defaultChecked: false },
];

// ── Design tokens ──
const BG      = '#0F0E1A';
const PANEL   = '#16152A';
const CARD    = 'rgba(255,255,255,0.04)';
const BORDER  = 'rgba(255,255,255,0.08)';
const BRAND   = '#534AB7';
const BRAND2  = '#7C3AED';
const FG      = '#F1F0FA';
const MUTED   = 'rgba(255,255,255,0.45)';
const INPUT_BG = 'rgba(255,255,255,0.05)';

export function Onboarding({ organization, onComplete }: OnboardingProps) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  const [orgName, setOrgName] = useState(organization.name || '');
  const [sector, setSector] = useState('');
  const [size, setSize] = useState('');
  const [objective, setObjective] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(['github']));
  const [alertEmail, setAlertEmail] = useState('');
  const [alertChecks, setAlertChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(ALERT_OPTIONS.map(a => [a.key, a.defaultChecked]))
  );
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [platformsCreatedCount, setPlatformsCreatedCount] = useState(0);

  const goTo   = (idx: number) => setCurrent(idx);
  const goNext = () => { if (current < TOTAL) setCurrent(c => c + 1); };
  const goPrev = () => { if (current > 0) setCurrent(c => c - 1); };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const result = await api.auth.applyPromo(promoCode.trim());
      setPromoApplied(true);
      toast.success(result.message || 'Plan Pro activé pour 1 mois !');
      onComplete(result);
    } catch (err: unknown) {
      setPromoError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setPromoLoading(false);
    }
  };

  const skipAll = async () => { await save(); };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.auth.completeOnboarding({
        org_name: orgName || undefined,
        sector,
        size,
        objective,
        alert_email: alertEmail || undefined,
        alert_email_enabled: Object.values(alertChecks).some(Boolean),
        platforms: Array.from(selectedPlatforms),
      });
      setPlatformsCreatedCount(result.platformsCreated ?? 0);
      onComplete(result);
      goNext();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
      setSaving(false);
    }
  };

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const pct = current < TOTAL ? Math.round((current / TOTAL) * 100) : 100;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', background: BG, color: FG }}>

      {/* ── Left panel ── */}
      <aside style={{ width: 300, flexShrink: 0, background: PANEL, display: 'flex', flexDirection: 'column', padding: '40px 28px', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', borderRight: `1px solid ${BORDER}` }}
        className="hidden md:flex">

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <img src="/logo.png" alt="Tracix" style={{ height: 32, objectFit: 'contain' }} />
        </div>

        {/* Step nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {STEPS.map((s, i) => (
            <div key={i}
              onClick={() => { if (i <= current) goTo(i); }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 10px', borderRadius: 10, cursor: i <= current ? 'pointer' : 'default', background: i === current ? 'rgba(83,74,183,0.15)' : 'transparent', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (i <= current && i !== current) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === current ? 'rgba(83,74,183,0.15)' : 'transparent'; }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  background: i < current ? BRAND : i === current ? 'rgba(83,74,183,0.3)' : 'transparent',
                  border: `2px solid ${i < current ? BRAND : i === current ? BRAND : BORDER}`,
                  color: i < current ? '#fff' : i === current ? '#fff' : MUTED,
                  transition: 'all 0.2s',
                }}>
                  {i < current
                    ? <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 1, height: 22, background: BORDER, margin: '2px 0' }} />
                )}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 13, fontWeight: i === current ? 600 : 400, color: i === current ? '#fff' : i < current ? 'rgba(255,255,255,0.6)' : MUTED, transition: 'color 0.2s', lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 1, lineHeight: 1.4 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </nav>

        <div style={{ paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
            Modifiable à tout moment dans <span style={{ color: 'rgba(255,255,255,0.5)' }}>Paramètres</span>.
          </p>
        </div>
      </aside>

      {/* ── Right content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col items-center px-5 py-8 sm:px-10 sm:py-14 md:px-10 md:py-[60px] relative">

        {/* Background glow */}
        <div className="hidden sm:block" style={{ position: 'fixed', top: '20%', left: '55%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(83,74,183,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 560, marginBottom: 8, position: 'relative', zIndex: 1 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${BRAND}, ${BRAND2})`, borderRadius: 999, width: `${pct}%`, transition: 'width 0.4s cubic-bezier(.16,1,.3,1)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, fontFamily: 'ui-monospace,monospace', marginTop: 8 }}>
            <span>{current >= TOTAL ? 'Configuration terminée' : `Étape ${current + 1} sur ${TOTAL}`}</span>
            <span>{pct} %</span>
          </div>
        </div>

        {/* ── Step 0 : Bienvenue ── */}
        {current === 0 && (
          <StepPane>
            <div>
              <Pill>Prise en main</Pill>
              <h1 style={h1Style}>Bienvenue sur Tracix 👋</h1>
              <p style={subtitleStyle}>
                Ce court tutoriel vous guide en <strong style={{ color: FG }}>5 étapes</strong> pour configurer votre espace, connecter vos plateformes et activer les alertes.<br />
                Comptez environ <strong style={{ color: FG }}>3 à 5 minutes</strong>.
              </p>
            </div>
            <TipBox>
              <strong>Vos données restent privées.</strong> Ces informations servent uniquement à personnaliser votre expérience Tracix et ne sont jamais partagées avec des tiers.
            </TipBox>
            <Actions>
              <span style={{ flex: 1 }} />
              <GhostBtn onClick={saving ? undefined : skipAll} disabled={saving}>
                {saving ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : null}
                Passer la configuration
              </GhostBtn>
              <PrimaryBtn onClick={goNext}>
                Commencer <ArrowRight />
              </PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 1 : Organisation ── */}
        {current === 1 && (
          <StepPane>
            <div>
              <Pill>Étape 1 / 4</Pill>
              <h1 style={h1Style}>Votre organisation</h1>
              <p style={subtitleStyle}>Définissez le périmètre de votre espace Tracix. Modifiable à tout moment dans <em>Paramètres</em>.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Nom de l'organisation">
                <input value={orgName} onChange={e => setOrgName(e.target.value)}
                  placeholder="ex. DSSI Groupe Nexia, Acme Corp…"
                  style={inputStyle} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <Field label="Secteur d'activité">
                  <select value={sector} onChange={e => setSector(e.target.value)} style={inputStyle}>
                    <option value="">Sélectionner…</option>
                    <option>Finance / Banque</option>
                    <option>Santé</option>
                    <option>Industrie</option>
                    <option>Administration publique</option>
                    <option>Retail / E-commerce</option>
                    <option>Technologie / SaaS</option>
                    <option>Télécommunications</option>
                    <option>Autre</option>
                  </select>
                </Field>
                <Field label="Taille">
                  <select value={size} onChange={e => setSize(e.target.value)} style={inputStyle}>
                    <option value="">Sélectionner…</option>
                    <option>1 – 50 employés</option>
                    <option>51 – 250 employés</option>
                    <option>251 – 1 000 employés</option>
                    <option>1 001 – 5 000 employés</option>
                    <option>+ 5 000 employés</option>
                  </select>
                </Field>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: FG, marginBottom: 12 }}>Objectif principal avec Tracix</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {OBJECTIVES.map(o => (
                  <div key={o.key}
                    onClick={() => setObjective(o.key)}
                    style={{
                      border: `1.5px solid ${objective === o.key ? BRAND : BORDER}`,
                      borderRadius: 12, padding: '16px 16px', cursor: 'pointer',
                      background: objective === o.key ? 'rgba(83,74,183,0.15)' : CARD,
                      boxShadow: objective === o.key ? `0 0 0 3px rgba(83,74,183,0.2)` : 'none',
                      transition: 'all 0.15s',
                      backdropFilter: 'blur(8px)',
                    }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(83,74,183,0.2)', display: 'grid', placeItems: 'center', marginBottom: 10 }}>
                      <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {o.icon.split(' M').map((seg, j) => <path key={j} d={j === 0 ? seg : 'M' + seg} />)}
                      </svg>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{o.title}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{o.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <Actions>
              <GhostBtn onClick={goPrev}><ArrowLeft /> Retour</GhostBtn>
              <span style={{ flex: 1 }} />
              <TextBtn onClick={goNext}>Passer</TextBtn>
              <PrimaryBtn onClick={goNext}>Continuer <ArrowRight /></PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 2 : Plateformes ── */}
        {current === 2 && (
          <StepPane>
            <div>
              <Pill>Étape 2 / 4</Pill>
              <h1 style={h1Style}>Vos plateformes à surveiller</h1>
              <p style={subtitleStyle}>Cochez les services que vous gérez. Tracix les ajoutera à votre inventaire — vous pourrez renseigner les détails ensuite dans <em>Plateformes</em>.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLATFORMS.map(p => {
                const checked = selectedPlatforms.has(p.key);
                return (
                  <div key={p.key}
                    onClick={() => togglePlatform(p.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${checked ? BRAND : BORDER}`,
                      background: checked ? 'rgba(83,74,183,0.12)' : CARD,
                      backdropFilter: 'blur(8px)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${checked ? BRAND : 'rgba(255,255,255,0.2)'}`,
                      background: checked ? BRAND : 'transparent',
                      display: 'grid', placeItems: 'center', transition: 'all 0.15s',
                    }}>
                      {checked && <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${p.color}22`, color: p.color, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {p.mono}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: FG }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{p.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <TipBox icon="shield">
              <strong>Information.</strong> Cette sélection ne crée pas de connexion automatique — elle pré-remplit votre inventaire pour que vous puissiez saisir les détails rapidement depuis <em>Plateformes</em>.
            </TipBox>
            <Actions>
              <GhostBtn onClick={goPrev}><ArrowLeft /> Retour</GhostBtn>
              <span style={{ flex: 1 }} />
              <TextBtn onClick={goNext}>Passer</TextBtn>
              <PrimaryBtn onClick={goNext}>Continuer <ArrowRight /></PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 3 : Inviter ── */}
        {current === 3 && (
          <StepPane>
            <div>
              <Pill>Étape 3 / 4</Pill>
              <h1 style={h1Style}>Inviter votre équipe</h1>
              <p style={subtitleStyle}>Vous pouvez inviter des collègues maintenant ou plus tard depuis <em>Paramètres → Membres</em>. Cette étape est optionnelle.</p>
            </div>
            <div style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                <strong style={{ color: FG }}>Invitations par email.</strong> Les membres invités recevront un lien pour créer leur compte Tracix. Rôles disponibles : <em>Admin</em> (accès complet), <em>Manager</em> (lecture + alertes), <em>Viewer</em> (consultation seule).
              </div>
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, backdropFilter: 'blur(8px)' }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: FG }}>Invitations disponibles depuis l'application</p>
              <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
                Rendez-vous dans <strong style={{ color: FG }}>Paramètres → Membres → Inviter</strong> pour envoyer des invitations après avoir terminé la configuration initiale.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <div style={{ padding: '4px 10px', background: 'rgba(83,74,183,0.2)', color: '#9D94E8', fontSize: 11.5, fontWeight: 600, borderRadius: 6 }}>Admin</div>
                <div style={{ padding: '4px 10px', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontSize: 11.5, fontWeight: 600, borderRadius: 6 }}>Manager</div>
                <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.06)', color: MUTED, fontSize: 11.5, fontWeight: 600, borderRadius: 6 }}>Viewer</div>
              </div>
            </div>
            <Actions>
              <GhostBtn onClick={goPrev}><ArrowLeft /> Retour</GhostBtn>
              <span style={{ flex: 1 }} />
              <TextBtn onClick={goNext}>Passer</TextBtn>
              <PrimaryBtn onClick={goNext}>Continuer <ArrowRight /></PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 4 : Alertes ── */}
        {current === 4 && (
          <StepPane>
            <div>
              <Pill>Étape 4 / 4</Pill>
              <h1 style={h1Style}>Configurer les alertes</h1>
              <p style={subtitleStyle}>Choisissez les événements à surveiller. Affinez ces règles à tout moment depuis <em>Alertes → Paramètres</em>.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: FG, marginBottom: 4 }}>Notifications email pour :</div>
              {ALERT_OPTIONS.map(a => (
                <label key={a.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${alertChecks[a.key] ? BRAND : BORDER}`, borderRadius: 10, cursor: 'pointer', background: alertChecks[a.key] ? 'rgba(83,74,183,0.1)' : CARD, backdropFilter: 'blur(8px)', transition: 'all 0.15s' }}>
                  <input type="checkbox"
                    checked={alertChecks[a.key]}
                    onChange={e => setAlertChecks(p => ({ ...p, [a.key]: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: BRAND, cursor: 'pointer', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: FG }}>{a.label}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{a.sub}</div>
                  </div>
                </label>
              ))}
            </div>
            <Field label="Email de notification (optionnel)">
              <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)}
                placeholder="security@entreprise.fr"
                style={inputStyle} />
            </Field>
            <Actions>
              <GhostBtn onClick={goPrev}><ArrowLeft /> Retour</GhostBtn>
              <span style={{ flex: 1 }} />
              <PrimaryBtn onClick={goNext}>Continuer <ArrowRight /></PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 5 : Passer à Pro ── */}
        {current === 5 && (
          <StepPane>
            <div>
              <Pill>Dernière étape</Pill>
              <h1 style={h1Style}>Débloquez tout Tracix</h1>
              <p style={subtitleStyle}>
                Le plan gratuit vous permet de démarrer. Passez à <strong style={{ color: FG }}>Pro</strong> pour importer vos fichiers et accéder à toutes les fonctionnalités avancées.
              </p>
            </div>

            {/* Free vs Pro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Free */}
              <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '20px 18px', background: CARD, backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Gratuit</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: FG, marginBottom: 16 }}>0 <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>XOF / mois</span></div>
                {[
                  '25 membres maximum',
                  'Plateformes illimitées',
                  '3 sièges Tracix',
                  'Alertes et rapports basiques',
                  '— Import Excel / CSV',
                  '— Modules personnalisés',
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12.5, color: f.startsWith('—') ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)' }}>
                    {!f.startsWith('—')
                      ? <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#1D9E75" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1 }}>–</span>}
                    <span>{f.replace('— ', '')}</span>
                  </div>
                ))}
              </div>

              {/* Pro */}
              <div style={{ border: `2px solid ${BRAND}`, borderRadius: 14, padding: '20px 18px', background: 'rgba(83,74,183,0.12)', backdropFilter: 'blur(12px)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 12, right: 12, background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: '0.06em' }}>RECOMMANDÉ</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9D94E8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pro</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: FG, marginBottom: 16 }}>30 000 <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>XOF / mois</span></div>
                {[
                  'Membres & plateformes illimités',
                  '5 sièges administrateurs',
                  'Import Excel / CSV / JSON',
                  'Modules personnalisés',
                  'Rapports PDF avancés',
                  'Score de risque IA',
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>
                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code promo */}
            {!promoApplied ? (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: FG, marginBottom: 8 }}>
                  Vous avez un code promo ? <span style={{ fontWeight: 400, color: MUTED }}>1 mois Pro offert</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                    placeholder="ex. TRACIX1MOIS"
                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                    style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'ui-monospace,monospace', fontSize: 13 }}
                  />
                  <button
                    onClick={applyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                    style={{ padding: '10px 16px', borderRadius: 8, background: promoCode.trim() ? `linear-gradient(135deg, ${BRAND}, ${BRAND2})` : 'rgba(255,255,255,0.06)', color: promoCode.trim() ? '#fff' : MUTED, border: 'none', fontWeight: 600, fontSize: 13, cursor: promoCode.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {promoLoading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : null}
                    Appliquer
                  </button>
                </div>
                {promoError && (
                  <div style={{ fontSize: 12, color: '#EF4444', marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {promoError}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'rgba(29,158,117,0.08)', border: '1.5px solid rgba(29,158,117,0.3)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#1D9E75" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>Plan Pro activé pour 1 mois !</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Accès complet à toutes les fonctionnalités Tracix Pro.</div>
                </div>
              </div>
            )}

            <Actions>
              <GhostBtn onClick={goPrev}><ArrowLeft /> Retour</GhostBtn>
              <span style={{ flex: 1 }} />
              <TextBtn onClick={save} disabled={saving}>Passer pour l'instant</TextBtn>
              <PrimaryBtn onClick={save} disabled={saving}>
                {saving ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : null}
                {saving ? 'Finalisation…' : 'Accéder au dashboard'}
                {!saving && <ArrowRight />}
              </PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 6 : Succès ── */}
        {current >= TOTAL && (
          <StepPane>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '20px 0 8px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(29,158,117,0.12)', display: 'grid', placeItems: 'center', border: '2px solid rgba(29,158,117,0.3)', animation: 'popIn 0.5s cubic-bezier(.16,1,.3,1) both' }}>
                <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="#1D9E75" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: FG }}>Tracix est prêt !</h1>
              <p style={{ fontSize: 14, color: MUTED, maxWidth: 400, lineHeight: 1.65 }}>
                Votre espace est configuré. Voici quelques raccourcis pour démarrer rapidement.
              </p>
              {platformsCreatedCount > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(29,158,117,0.1)', color: '#1D9E75', fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(29,158,117,0.25)' }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {platformsCreatedCount} plateforme{platformsCreatedCount > 1 ? 's' : ''} ajoutée{platformsCreatedCount > 1 ? 's' : ''} à votre inventaire
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { path: '/dashboard',  title: "Vue d'ensemble",  sub: 'KPIs, alertes actives, score de risque',   icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
                { path: '/membres',    title: 'Membres',          sub: 'Gérer les utilisateurs et leurs accès',    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z' },
                { path: '/alertes',    title: 'Alertes',          sub: 'Réviser les incidents en attente',         icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0' },
                { path: '/parametres', title: 'Paramètres',       sub: 'Affiner les règles et les modules',        icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
              ].map(item => (
                <a key={item.path} href={item.path}
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12, textDecoration: 'none', color: 'inherit', transition: 'all 0.15s', cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND; (e.currentTarget as HTMLElement).style.background = 'rgba(83,74,183,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.background = CARD; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(83,74,183,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {item.icon.split(' M').map((seg, j) => <path key={j} d={j === 0 ? seg : 'M' + seg} />)}
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{item.title}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{item.sub}</div>
                  </div>
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
              <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`, color: '#fff', textDecoration: 'none', border: 'none', boxShadow: '0 4px 20px rgba(83,74,183,0.4)' }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Accéder au tableau de bord
              </a>
            </div>
          </StepPane>
        )}

      </main>
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        select option { background: #1E1C35; color: #F1F0FA; }
      `}</style>
    </div>
  );
}

// ── Sub-components ──

function StepPane({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 26, animation: 'fadeSlideIn 0.3s ease both', position: 'relative', zIndex: 1 }}>
      {children}
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(83,74,183,0.18)', color: '#9D94E8', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(83,74,183,0.3)' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: BRAND, display: 'inline-block' }} />
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.01em' }}>{label}</label>
      {children}
    </div>
  );
}

function TipBox({ children, icon = 'info' }: { children: React.ReactNode; icon?: string }) {
  return (
    <div style={{ background: 'rgba(83,74,183,0.1)', border: '1px solid rgba(83,74,183,0.25)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', backdropFilter: 'blur(8px)' }}>
      <span style={{ color: '#9D94E8', flexShrink: 0, marginTop: 1 }}>
        {icon === 'shield'
          ? <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          : <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        }
      </span>
      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{children}</p>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">{children}</div>;
}

function PrimaryBtn({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`, color: '#fff', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap', boxShadow: disabled ? 'none' : '0 4px 16px rgba(83,74,183,0.35)' }}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', border: `1.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)', color: MUTED, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function TextBtn({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 12.5, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', padding: '10px 4px' }}>
      {children}
    </button>
  );
}

function ArrowRight() {
  return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
}

function ArrowLeft() {
  return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  border: `1.5px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 13.5,
  fontFamily: 'inherit',
  color: FG,
  background: INPUT_BG,
  outline: 'none',
  WebkitAppearance: 'none',
};

const h1Style: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: FG,
  lineHeight: 1.25,
  marginTop: 12,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: MUTED,
  lineHeight: 1.65,
  marginTop: 8,
};
