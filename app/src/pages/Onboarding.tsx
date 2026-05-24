// ═══════════════════════════════════════════
// Onboarding — Prise en main Tracix
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
  { label: 'Bienvenue',         sub: 'Personnaliser votre profil' },
  { label: 'Organisation',      sub: 'Nom, secteur, objectif' },
  { label: 'Plateformes',       sub: 'Vos services à surveiller' },
  { label: "Inviter l'équipe",  sub: 'Emails et rôles' },
  { label: 'Alertes',           sub: 'Notifications et seuils' },
];
const TOTAL = STEPS.length;

const OBJECTIVES = [
  { key: 'access', title: 'Gestion des accès', sub: 'Centraliser les droits membres et plateformes', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  { key: 'security', title: 'Sécurité & conformité', sub: 'Réduire les risques, auditer, reporter', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { key: 'risk', title: 'Score de risque', sub: 'Surveiller et scorer les utilisateurs à risque', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { key: 'audit', title: 'Audit & rapports', sub: 'Journal d\'activité et rapports conformité', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8' },
];

const PLATFORMS = [
  { key: 'aws',     label: 'AWS IAM',                sub: 'Rôles, politiques, groupes',        mono: 'AW', bg: 'oklch(48% 0.18 260 / 0.1)', color: 'oklch(48% 0.18 260)' },
  { key: 'azure',   label: 'Azure Active Directory', sub: 'Utilisateurs, groupes Entra ID',    mono: 'AZ', bg: 'oklch(55% 0.2 240 / 0.1)',  color: 'oklch(55% 0.2 240)'  },
  { key: 'github',  label: 'GitHub',                 sub: 'Organisations, équipes, dépôts',    mono: 'GH', bg: 'oklch(55% 0.14 160 / 0.1)', color: 'oklch(55% 0.14 160)' },
  { key: 'google',  label: 'Google Workspace',       sub: 'Comptes, groupes, Drive',           mono: 'GC', bg: 'oklch(60% 0.18 50 / 0.1)',  color: 'oklch(60% 0.18 50)'  },
  { key: 'okta',    label: 'Okta',                   sub: 'SSO, applications, groupes',        mono: 'OK', bg: 'oklch(65% 0.12 120 / 0.1)', color: 'oklch(65% 0.12 120)' },
  { key: 'slack',   label: 'Slack',                  sub: 'Espaces de travail, canaux',        mono: 'SL', bg: 'oklch(55% 0.14 300 / 0.1)', color: 'oklch(55% 0.14 300)' },
  { key: 'jira',    label: 'Jira / Confluence',      sub: 'Projets, accès Atlassian',          mono: 'JI', bg: 'oklch(50% 0.18 240 / 0.1)', color: 'oklch(50% 0.18 240)' },
  { key: 'other',   label: 'Autre (personnalisé)',   sub: 'Créez manuellement dans Tracix',    mono: '+',  bg: 'oklch(52% 0.01 260 / 0.1)', color: 'oklch(52% 0.01 260)' },
];

const ALERT_OPTIONS = [
  { key: 'risk_critical',   label: 'Comptes avec score de risque Critique',    sub: 'Alerte immédiate dès qu\'un membre passe en zone rouge', defaultChecked: true },
  { key: 'overdue_access',  label: 'Droits d\'accès expirés non révoqués',      sub: 'Rapport hebdomadaire des habilitations en dépassement', defaultChecked: true },
  { key: 'no_mfa',          label: 'Plateformes sans MFA détectées',            sub: 'Notification dès qu\'une plateforme admin n\'a pas le MFA', defaultChecked: true },
  { key: 'sub_expiring',    label: 'Abonnements expirant dans 30 jours',        sub: 'Rappel de renouvellement avant expiration', defaultChecked: false },
  { key: 'daily_summary',   label: 'Résumé quotidien de l\'activité',           sub: 'Synthèse des événements des dernières 24 h', defaultChecked: false },
];

const BRAND   = 'oklch(42% 0.18 280)';
const BORDER  = 'oklch(90% 0.006 260)';
const FG      = 'oklch(18% 0.02 260)';
const MUTED   = 'oklch(52% 0.012 260)';
const SURFACE = 'oklch(100% 0 0)';
const BRAND_MUTED = 'oklch(42% 0.12 280 / 0.12)';

export function Onboarding({ organization, onComplete }: OnboardingProps) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [orgName, setOrgName] = useState(organization.name || '');
  const [sector, setSector] = useState('');
  const [size, setSize] = useState('');
  const [objective, setObjective] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(['github']));
  const [alertEmail, setAlertEmail] = useState('');
  const [alertChecks, setAlertChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(ALERT_OPTIONS.map(a => [a.key, a.defaultChecked]))
  );

  const goTo = (idx: number) => setCurrent(idx);
  const goNext = () => { if (current < TOTAL) setCurrent(c => c + 1); };
  const goPrev = () => { if (current > 0) setCurrent(c => c - 1); };

  const skipAll = async () => {
    await save();
  };

  const save = async () => {
    setSaving(true);
    try {
      const updatedOrg = await api.auth.completeOnboarding({
        org_name: orgName || undefined,
        sector,
        size,
        objective,
        alert_email: alertEmail || undefined,
        alert_email_enabled: Object.values(alertChecks).some(Boolean),
      });
      onComplete(updatedOrg);
      navigate('/dashboard');
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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>

      {/* ── Left panel ── */}
      <aside style={{ width: 340, flexShrink: 0, background: 'oklch(16% 0.03 270)', display: 'flex', flexDirection: 'column', padding: '40px 32px', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}
        className="hidden md:flex">
        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <img src="/logo.png" alt="Tracix" style={{ height: 32, objectFit: 'contain' }} />
        </div>

        {/* Step nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {STEPS.map((s, i) => (
            <div key={i}
              onClick={() => { if (i <= current) goTo(i); }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 10px', borderRadius: 9, cursor: i <= current ? 'pointer' : 'default', background: 'transparent', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (i <= current) (e.currentTarget as HTMLElement).style.background = 'oklch(100% 0 0 / 0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  background: i < current ? BRAND : i === current ? 'oklch(100% 0 0 / 0.08)' : 'transparent',
                  border: `2px solid ${i < current ? BRAND : i === current ? '#fff' : 'oklch(100% 0 0 / 0.15)'}`,
                  color: i < current ? '#fff' : i === current ? '#fff' : 'oklch(100% 0 0 / 0.4)',
                  transition: 'all 0.2s',
                }}>
                  {i < current
                    ? <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 1, height: 24, background: 'oklch(100% 0 0 / 0.1)', margin: '2px 0' }} />
                )}
              </div>
              <div style={{ paddingTop: 1 }}>
                <div style={{ fontSize: 13, fontWeight: i === current ? 600 : 500, color: i === current ? '#fff' : i < current ? 'oklch(100% 0 0 / 0.65)' : 'oklch(100% 0 0 / 0.5)', transition: 'color 0.2s', lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: i === current ? 'oklch(100% 0 0 / 0.5)' : 'oklch(100% 0 0 / 0.3)', marginTop: 1, lineHeight: 1.4 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </nav>

        <div style={{ paddingTop: 24, borderTop: '1px solid oklch(100% 0 0 / 0.08)' }}>
          <p style={{ fontSize: 11.5, color: 'oklch(100% 0 0 / 0.35)', lineHeight: 1.6 }}>
            Vous pouvez modifier ces paramètres à tout moment dans <span style={{ color: 'oklch(100% 0 0 / 0.55)' }}>Paramètres</span>.
          </p>
        </div>
      </aside>

      {/* ── Right content ── */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 40px 80px', background: 'oklch(97% 0.005 260)' }}>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 560, marginBottom: 8 }}>
          <div style={{ height: 4, background: BORDER, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: BRAND, borderRadius: 999, width: `${pct}%`, transition: 'width 0.4s cubic-bezier(.16,1,.3,1)' }} />
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
              <Badge>Prise en main</Badge>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: FG, lineHeight: 1.25, marginTop: 12 }}>Bienvenue sur Tracix 👋</h1>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginTop: 8 }}>
                Ce court tutoriel vous guide en <strong>5 étapes</strong> pour configurer votre espace, connecter vos plateformes et activer les alertes.<br />
                Comptez environ <strong>3 à 5 minutes</strong>.
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
                Commencer
                <ArrowRight />
              </PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 1 : Organisation ── */}
        {current === 1 && (
          <StepPane>
            <div>
              <Badge>Étape 1 / 4</Badge>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: FG, lineHeight: 1.25, marginTop: 12 }}>Votre organisation</h1>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginTop: 8 }}>
                Définissez le périmètre de votre espace Tracix. Modifiable à tout moment dans <em>Paramètres</em>.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Nom de l'organisation">
                <input value={orgName} onChange={e => setOrgName(e.target.value)}
                  placeholder="ex. DSSI Groupe Nexia, Acme Corp…"
                  style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
              <p style={{ fontSize: 12.5, fontWeight: 600, color: FG, marginBottom: 10 }}>Objectif principal avec Tracix</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {OBJECTIVES.map(o => (
                  <div key={o.key}
                    onClick={() => setObjective(o.key)}
                    style={{
                      border: `1.5px solid ${objective === o.key ? BRAND : BORDER}`,
                      borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
                      background: objective === o.key ? BRAND_MUTED : SURFACE,
                      boxShadow: objective === o.key ? `0 0 0 3px oklch(42% 0.18 280 / 0.1)` : 'none',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: BRAND_MUTED, display: 'grid', placeItems: 'center', marginBottom: 10 }}>
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
              <Badge>Étape 2 / 4</Badge>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: FG, lineHeight: 1.25, marginTop: 12 }}>Vos plateformes à surveiller</h1>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginTop: 8 }}>
                Cochez les services que vous gérez. Tracix les ajoutera à votre inventaire — vous pourrez renseigner les détails ensuite dans <em>Plateformes</em>.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLATFORMS.map(p => {
                const checked = selectedPlatforms.has(p.key);
                return (
                  <div key={p.key}
                    onClick={() => togglePlatform(p.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', border: `1.5px solid ${checked ? BRAND : BORDER}`,
                      borderRadius: 8, cursor: 'pointer',
                      background: checked ? BRAND_MUTED : SURFACE,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${checked ? BRAND : BORDER}`,
                      background: checked ? BRAND : SURFACE,
                      display: 'grid', placeItems: 'center', transition: 'all 0.15s',
                    }}>
                      {checked && <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: p.bg, color: p.color, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
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
              <Badge>Étape 3 / 4</Badge>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: FG, lineHeight: 1.25, marginTop: 12 }}>Inviter votre équipe</h1>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginTop: 8 }}>
                Vous pouvez inviter des collègues maintenant ou plus tard depuis <em>Paramètres → Membres</em>. Cette étape est optionnelle.
              </p>
            </div>
            <div style={{ background: 'oklch(62% 0.16 155 / 0.08)', border: '1px solid oklch(62% 0.16 155 / 0.25)', borderRadius: 10, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="oklch(55% 0.16 155)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <div style={{ fontSize: 12.5, color: 'oklch(35% 0.12 155)', lineHeight: 1.55 }}>
                <strong>Invitations par email.</strong> Les membres invités recevront un lien pour créer leur compte Tracix. Rôles disponibles : <em>Admin</em> (accès complet), <em>Manager</em> (lecture + alertes), <em>Viewer</em> (consultation seule).
              </div>
            </div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: FG }}>Invitations disponibles depuis l'application</p>
              <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
                Rendez-vous dans <strong>Paramètres → Membres → Inviter</strong> pour envoyer des invitations après avoir terminé la configuration initiale.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <div style={{ padding: '4px 10px', background: BRAND_MUTED, color: BRAND, fontSize: 11.5, fontWeight: 600, borderRadius: 6 }}>Admin</div>
                <div style={{ padding: '4px 10px', background: 'oklch(62% 0.18 52 / 0.1)', color: 'oklch(55% 0.18 52)', fontSize: 11.5, fontWeight: 600, borderRadius: 6 }}>Manager</div>
                <div style={{ padding: '4px 10px', background: 'oklch(52% 0.01 260 / 0.1)', color: MUTED, fontSize: 11.5, fontWeight: 600, borderRadius: 6 }}>Viewer</div>
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
              <Badge>Étape 4 / 4</Badge>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: FG, lineHeight: 1.25, marginTop: 12 }}>Configurer les alertes</h1>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginTop: 8 }}>
                Choisissez les événements à surveiller. Affinez ces règles à tout moment depuis <em>Alertes → Paramètres</em>.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: FG, marginBottom: 4 }}>Notifications email pour :</div>
              {ALERT_OPTIONS.map(a => (
                <label key={a.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s', background: SURFACE }}>
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
              <PrimaryBtn onClick={save} disabled={saving}>
                {saving ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : null}
                {saving ? 'Sauvegarde…' : 'Terminer la configuration'}
                {!saving && <ArrowRight />}
              </PrimaryBtn>
            </Actions>
          </StepPane>
        )}

        {/* ── Step 5 : Succès ── */}
        {current >= TOTAL && (
          <StepPane>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '20px 0 8px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'oklch(62% 0.16 155 / 0.1)', display: 'grid', placeItems: 'center', animation: 'popIn 0.5s cubic-bezier(.16,1,.3,1) both' }}>
                <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="oklch(62% 0.16 155)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ strokeDasharray: 60, strokeDashoffset: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: FG }}>Tracix est prêt !</h1>
              <p style={{ fontSize: 14, color: MUTED, maxWidth: 400, lineHeight: 1.65 }}>
                Votre espace est configuré. Voici quelques raccourcis pour démarrer rapidement.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { path: '/dashboard',    title: 'Vue d\'ensemble',     sub: 'KPIs, alertes actives, score de risque', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
                { path: '/membres',      title: 'Membres',             sub: 'Gérer les utilisateurs et leurs accès', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z' },
                { path: '/alertes',      title: 'Alertes',             sub: 'Réviser les incidents en attente', icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0' },
                { path: '/parametres',   title: 'Paramètres',          sub: 'Affiner les règles et les modules', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
              ].map(item => (
                <a key={item.path} href={item.path}
                  style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12, textDecoration: 'none', color: 'inherit', transition: 'all 0.15s', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND_MUTED, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
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
              <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: 'oklch(62% 0.16 155)', color: '#fff', textDecoration: 'none', border: 'none' }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Accéder au tableau de bord
              </a>
            </div>
          </StepPane>
        )}

      </main>
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

// ── Sub-components ──

function StepPane({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 28, animation: 'fadeSlideIn 0.3s ease both' }}>
      {children}
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND_MUTED, color: BRAND, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: BRAND, display: 'inline-block' }} />
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: FG, letterSpacing: '0.01em' }}>{label}</label>
      {children}
    </div>
  );
}

function TipBox({ children, icon = 'info' }: { children: React.ReactNode; icon?: string }) {
  return (
    <div style={{ background: BRAND_MUTED, border: '1px solid oklch(42% 0.18 280 / 0.2)', borderRadius: 9, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: BRAND, flexShrink: 0, marginTop: 1 }}>
        {icon === 'shield'
          ? <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          : <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        }
      </span>
      <p style={{ fontSize: 12.5, color: 'oklch(38% 0.16 280)', lineHeight: 1.55 }}>{children}</p>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>{children}</div>;
}

function PrimaryBtn({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', background: BRAND, color: '#fff', opacity: disabled ? 0.7 : 1, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', border: `1.5px solid ${BORDER}`, background: SURFACE, color: MUTED, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function TextBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', padding: '10px 4px' }}>
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
  width: '100%', padding: '10px 13px',
  border: `1.5px solid ${BORDER}`, borderRadius: 8,
  fontSize: 13.5, fontFamily: 'inherit', color: FG,
  background: SURFACE, outline: 'none',
  WebkitAppearance: 'none',
};
