// ═══════════════════════════════════════════
// Landing Page — Tracix by Agbaya Group
// ═══════════════════════════════════════════

import { useState } from 'react';
import {
  Shield, ArrowRight, CheckCircle, Users,
  Lock, Mail, Eye, EyeOff, Menu, X,
  Star, Crown, Zap, AlertTriangle,
  ShieldCheck, KeyRound, Building2,
} from 'lucide-react';
import { api } from '@/lib/api';

type LoginResult = { ok: true } | { mfa_required: true; user_id: string } | { ok: false; error?: string };

interface LandingProps {
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onLoginWithMfa: (userId: string, totp: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
  onRegister: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }>;
}

// ─── Pricing data ────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free', label: 'Free', color: '#6B7280',
    monthly: 0, annual: 0,
    desc: 'Idéal pour explorer Tracix et les petites équipes.',
    features: ['25 membres maximum', 'Plateformes illimitées', 'Audit basique (30 jours)', 'Tableau de bord accès', 'Support communautaire'],
    cta: 'Commencer',
    popular: false,
  },
  {
    id: 'pro', label: 'Pro', color: '#534AB7',
    monthly: 30_000, annual: 24_000,
    desc: 'Pour les équipes en croissance qui veulent une conformité solide.',
    features: ['Membres illimités', '5 sièges administrateurs', 'Export CSV & rapports IA', 'Alertes email & webhooks', 'Score de risque avancé', 'Audit 12 mois + conformité', 'Support prioritaire'],
    cta: "Démarrer l'essai",
    popular: true,
  },
  {
    id: 'enterprise', label: 'Enterprise', color: '#F59E0B',
    monthly: 90_000, annual: 72_000,
    desc: 'Pour les organisations avec des exigences strictes de sécurité.',
    features: ['Tout le plan Pro', 'Sièges illimités', 'Multi-organisations', 'SSO / SAML 2.0', 'API REST complète', 'SLA garanti 99.9%', 'Customer Success dédié'],
    cta: 'Nous contacter',
    popular: false,
  },
];

// ─── Main Landing ─────────────────────────────────────────────────────────────

export function Landing({ onLogin, onLoginWithMfa, onRegister }: LandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSsoModal, setShowSsoModal] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<'login' | 'register'>('login');
  const [billingAnnual, setBillingAnnual] = useState(true);

  const openLogin = () => { setModalDefaultTab('login'); setShowLoginModal(true); };
  const openRegister = () => { setModalDefaultTab('register'); setShowLoginModal(true); };

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#0F0E1A', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Navbar ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, background: 'rgba(15,14,26,0.72)', backdropFilter: 'blur(20px) saturate(1.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center">
            <img src="/logo.png" alt="Tracix" className="h-8 w-auto object-contain" />
          </a>

          <div className="hidden md:flex items-center gap-2">
            {[['Fonctionnalités', '#features'], ['Tarifs', '#pricing'], ['Intégrations', '#integrations'], ['À propos', '#about']].map(([l, h]) => (
              <a key={h} href={h} className="text-sm px-3 py-2 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              >{l}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => setShowSsoModal(true)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <ShieldCheck className="w-3.5 h-3.5" /> SSO
            </button>
            <button onClick={openLogin} className="text-sm px-3 py-2 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Se connecter
            </button>
            <button onClick={openRegister} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
              Démarrer gratuitement <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.7)' }} /> : <Menu className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.7)' }} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden px-4 py-4 space-y-1" style={{ background: '#0B0A16', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[['Fonctionnalités', '#features'], ['Tarifs', '#pricing'], ['Intégrations', '#integrations']].map(([l, h]) => (
              <a key={h} href={h} onClick={() => setMobileMenuOpen(false)} className="block text-sm py-2.5 font-medium" style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{l}</a>
            ))}
            <button onClick={() => { openRegister(); setMobileMenuOpen(false); }} className="w-full mt-3 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
              Démarrer gratuitement
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', overflow: 'hidden' }}>
        {/* Photo background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Hero landing.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12 }} />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,14,26,0.7) 0%, rgba(15,14,26,0.5) 50%, rgba(15,14,26,0.95) 100%)' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(83,74,183,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.07) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #534AB7, transparent)', opacity: 0.2, filter: 'blur(120px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #7C3AED, transparent)', opacity: 0.15, filter: 'blur(100px)', pointerEvents: 'none' }} />

        <div className="relative max-w-6xl mx-auto px-6 text-center w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 text-sm font-medium"
            style={{ background: 'rgba(83,74,183,0.1)', borderColor: 'rgba(83,74,183,0.3)', color: '#A89FF0' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            IAM · IGA · Conformité ISO 27001 · SOC 2
          </div>

          <h1 className="font-black leading-tight tracking-tight mb-6" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            Prenez le contrôle<br />
            <span style={{ background: 'linear-gradient(135deg, #818CF8, #534AB7, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              de vos accès IT
            </span>
          </h1>

          <p className="text-lg mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Tracix centralise la gestion des habilitations, détecte les risques en temps réel et alerte votre équipe avant que les incidents surviennent.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button onClick={openRegister} className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 40px rgba(83,74,183,0.4)' }}>
              Démarrer gratuitement
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold border transition-all hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              Voir les fonctionnalités
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mb-16">
            {[
              { v: '100%', l: 'Sécurisé' }, { v: '<2 min', l: 'Pour démarrer' },
              { v: '7+', l: "Types d'alertes" }, { v: 'XOF', l: 'Paiement local' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className="text-2xl font-black text-white">{s.v}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.l}</p>
              </div>
            ))}
          </div>

          {/* App mockup */}
          <div style={{ position: 'relative', maxWidth: 960, margin: '0 auto' }}>
            <div style={{ position: 'absolute', inset: -16, borderRadius: 24, background: 'linear-gradient(135deg, #534AB7, #7C3AED, #1D9E75)', opacity: 0.25, filter: 'blur(32px)' }} />
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'linear-gradient(180deg, #0F0F1E, #0A0A16)', boxShadow: '0 0 80px rgba(83,74,183,0.3), 0 40px 80px rgba(0,0,0,0.6)' }}>
              {/* Browser bar */}
              <div style={{ height: 36, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(239,68,68,0.6)' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(245,158,11,0.6)' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(16,185,129,0.6)' }} />
                </div>
                <div style={{ flex: 1, maxWidth: 280, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6 }}>
                  <Lock style={{ width: 10, height: 10, color: 'rgba(16,185,129,0.7)' }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>app.tracix.io/dashboard</span>
                </div>
              </div>
              {/* App interior */}
              <div style={{ display: 'flex', height: 360 }}>
                {/* Sidebar */}
                <div className="hidden sm:flex flex-col" style={{ width: 168, flexShrink: 0, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                  <div style={{ padding: '0 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
                    <img src="/logo.png" style={{ height: 22, width: 'auto' }} alt="Tracix" />
                  </div>
                  {[
                    { l: 'Dashboard', active: true, dot: '#534AB7' },
                    { l: 'Habilitations', active: false, dot: '' },
                    { l: 'Membres', active: false, dot: '' },
                    { l: 'Score de risque', active: false, dot: '' },
                    { l: 'Alertes', active: false, dot: '', badge: '3' },
                    { l: 'Abonnements', active: false, dot: '' },
                    { l: 'Paramètres', active: false, dot: '' },
                  ].map(item => (
                    <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', margin: '1px 6px', borderRadius: 8, background: item.active ? 'rgba(83,74,183,0.15)' : 'transparent', color: item.active ? '#A89FF0' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: item.active ? 600 : 400 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.active ? '#534AB7' : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{item.l}</span>
                      {item.badge && <span style={{ fontSize: 9, background: '#EF4444', color: '#fff', padding: '1px 5px', borderRadius: 99, fontWeight: 700 }}>{item.badge}</span>}
                    </div>
                  ))}
                </div>
                {/* Dashboard content */}
                <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vue d'ensemble</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { l: 'Score moyen', v: '74', s: 'Conforme', c: '#1D9E75', bg: 'rgba(29,158,117,0.1)' },
                      { l: 'Alertes actives', v: '3', s: 'Critiques', c: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
                      { l: 'Membres actifs', v: '8', s: 'Sur 10 total', c: '#818CF8', bg: 'rgba(129,140,248,0.1)' },
                    ].map(card => (
                      <div key={card.l} style={{ background: card.bg, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{card.l}</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: card.c, lineHeight: 1 }}>{card.v}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{card.s}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { l: 'Revues dépassées', v: '2', c: '#EF9F27' },
                      { l: 'Abonnements suivis', v: '6', c: '#3B82F6' },
                    ].map(card => (
                      <div key={card.l} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{card.l}</p>
                        <p style={{ fontSize: 20, fontWeight: 800, color: card.c, lineHeight: 1 }}>{card.v}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 10, padding: '10px 12px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <AlertTriangle style={{ width: 11, height: 11, color: '#EF4444' }} />
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Alertes récentes</p>
                    </div>
                    {['Élodie T. — Départ non traité', 'Cloudflare — Renouvellement dans 8j'].map(a => (
                      <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted by ── */}
      <div style={{ padding: '32px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Fait pour les équipes IT de</p>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            {["Côte d'Ivoire 🇨🇮", 'Sénégal 🇸🇳', 'Cameroun 🇨🇲', 'Bénin 🇧🇯', 'France 🇫🇷', 'Et partout ailleurs 🌍'].map(c => (
              <span key={c} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '96px 24px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>Fonctionnalités</span>
            <h2 className="font-black mb-5" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.15 }}>
              Tout ce dont votre équipe IT<br />
              <span style={{ background: 'linear-gradient(135deg, #818CF8, #534AB7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                a réellement besoin
              </span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto', fontSize: 16 }}>
              Une plateforme complète pour gouverner vos accès, réduire vos risques et rester conforme.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { emoji: '🔐', color: '#534AB7', bg: 'rgba(83,74,183,0.1)', title: 'Gestion des habilitations', desc: "Visualisez et contrôlez tous les droits d'accès en une matrice claire. Qui a accès à quoi, depuis quand.", img: null },
              { emoji: '📊', color: '#1D9E75', bg: 'rgba(29,158,117,0.1)', title: 'Score de risque intelligent', desc: 'Chaque membre reçoit un score 0-100 calculé en temps réel selon ses accès, son statut et ses revues.', img: null },
              { emoji: '🔔', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', title: 'Alertes automatiques', desc: 'Détection proactive : comptes sans MFA, accès orphelins, abonnements expirants, départs non traités.', img: null },
              { emoji: '👥', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', title: 'Annuaire des membres', desc: "Gérez collaborateurs et équipes. Suivez l'offboarding sans jamais oublier de révoquer un accès.", img: null },
              { emoji: '💳', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', title: 'Suivi des abonnements', desc: 'Centralisez vos SaaS, coûts et renouvellements. Alertes avant expiration.', img: null },
              { emoji: '📋', color: '#EC4899', bg: 'rgba(236,72,153,0.1)', title: 'Audit & conformité', desc: "Journal complet de toutes les actions. Exportez vos rapports ISO 27001, SOC 2 prêts pour l'auditeur.", img: null },
            ].map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: f.bg, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 20 }}>
                  {f.emoji}
                </div>
                <h3 className="font-bold text-white mb-2.5" style={{ fontSize: 15 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #534AB7, transparent)', opacity: 0.08, filter: 'blur(120px)', pointerEvents: 'none' }} />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>Comment ça marche</span>
            <h2 className="text-white font-black" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Opérationnel en 3 étapes</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16, maxWidth: 480, margin: '16px auto 0' }}>
              Pas de semaines d'intégration. Tracix vous donne une visibilité complète en quelques heures.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Connectez vos plateformes', desc: "GitHub, AWS, Okta, Google Workspace — connectez vos outils grâce à nos connecteurs OAuth et SCIM.", img: '/Authentication-cuate.svg', color: '#534AB7' },
              { num: '02', title: 'Analysez les accès', desc: "Tracix cartographie automatiquement tous les droits, détecte les anomalies et calcule les scores de risque.", img: '/undraw_security_0ubl.svg', color: '#1D9E75' },
              { num: '03', title: 'Agissez et reportez', desc: "Révoquez les accès en un clic, déclenchez des alertes et exportez vos rapports de conformité.", img: '/undraw_two-factor-authentication_ofho.svg', color: '#F59E0B' },
            ].map(step => (
              <div key={step.num} className="relative text-center p-8 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 72, fontWeight: 900, color: `${step.color}15`, lineHeight: 1, marginBottom: 16, userSelect: 'none' }}>{step.num}</div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${step.color}20`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22 }}>{step.num === '01' ? '🔌' : step.num === '02' ? '🔍' : '📤'}</span>
                </div>
                <h3 className="font-bold text-white mb-2" style={{ fontSize: 15 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 20 }}>{step.desc}</p>
                <img src={step.img} alt={step.title} style={{ height: 120, width: 'auto', margin: '0 auto', opacity: 0.85 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section id="integrations" style={{ padding: '96px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>Intégrations</span>
            <h2 className="text-white font-black mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>S'intègre avec vos outils existants</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto' }}>Connectez GitHub, Google Workspace, Okta, Slack, Microsoft en quelques clics.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="sm:grid-cols-6">
            {[
              { src: '/github.svg', name: 'GitHub' }, { src: '/google.svg', name: 'Google' },
              { src: '/okta.svg', name: 'Okta' }, { src: '/slack.webp', name: 'Slack' },
              { src: '/microsoft.webp', name: 'Microsoft' }, { src: '/notion.svg', name: 'Notion' },
            ].map(item => (
              <div key={item.name} className="flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all hover:-translate-y-1"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <img src={item.src} alt={item.name} style={{ width: 40, height: 40, objectFit: 'contain', opacity: 0.8 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '96px 24px' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>Tarifs</span>
            <h2 className="text-white font-black mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Transparent. Prévisible. Accessible.</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto 32px' }}>Des tarifs pensés pour le marché ouest-africain. Aucune surprise.</p>

            {/* Toggle */}
            <div className="inline-flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <button onClick={() => setBillingAnnual(false)} className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                style={{ background: !billingAnnual ? '#534AB7' : 'transparent', color: !billingAnnual ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                Mensuel
              </button>
              <button onClick={() => setBillingAnnual(true)} className="px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                style={{ background: billingAnnual ? '#534AB7' : 'transparent', color: billingAnnual ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                Annuel
                <span style={{ fontSize: 10, background: '#10B981', color: '#fff', padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>-20%</span>
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map(plan => {
              const price = billingAnnual ? plan.annual : plan.monthly;
              return (
                <div key={plan.id} className="relative rounded-2xl p-7 border flex flex-col transition-all"
                  style={{
                    background: plan.popular ? 'linear-gradient(135deg, rgba(83,74,183,0.15), rgba(124,58,237,0.08))' : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                    borderColor: plan.popular ? '#534AB7' : 'rgba(255,255,255,0.06)',
                    boxShadow: plan.popular ? '0 0 60px rgba(83,74,183,0.2)' : 'none',
                  }}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-black text-white"
                      style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
                      ⭐ POPULAIRE
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-black text-white text-lg">{plan.label}</span>
                  </div>
                  <div className="mb-1 flex items-end gap-1">
                    <span className="font-black text-white" style={{ fontSize: 32 }}>{price === 0 ? '0' : price.toLocaleString('fr-FR')}</span>
                    <span className="text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}> XOF{price > 0 ? '/mois' : ''}</span>
                  </div>
                  <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.desc}</p>
                  <ul className="space-y-3 flex-1 mb-7">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => plan.id !== 'enterprise' ? openRegister() : window.open('mailto:contact@agbayagroup.com')}
                    className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: plan.popular ? 'linear-gradient(135deg, #534AB7, #7C3AED)' : 'transparent',
                      border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      color: plan.popular ? '#fff' : 'rgba(255,255,255,0.7)',
                    }}>
                    {plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-center mt-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Renouvellement garanti au même tarif · Paiement Mobile Money, virement ou carte · Facturation en XOF
          </p>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section style={{ padding: '96px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="p-10 rounded-3xl border text-center" style={{ background: 'linear-gradient(135deg, rgba(83,74,183,0.1), rgba(124,58,237,0.05))', borderColor: 'rgba(83,74,183,0.2)' }}>
            <div className="flex justify-center gap-1 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="text-xl font-medium mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
              "Tracix nous a permis de passer notre audit de sécurité en 2 semaines. La visibilité sur les accès est incomparable avec ce qu'on faisait avant en spreadsheet."
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #534AB7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>K</div>
              <div className="text-left">
                <p className="font-bold text-white">Kofi A.</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>RSSI — Fintech Abidjan 🇨🇮</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" style={{ padding: '96px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <img src="/logo.png" alt="Tracix" className="w-16 h-16 object-contain mx-auto mb-6" />
          <h2 className="font-black mb-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.15 }}>
            Conçu pour l'Afrique,<br />
            <span style={{ background: 'linear-gradient(135deg, #818CF8, #534AB7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              pensé pour le monde
            </span>
          </h2>
          <p className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Tracix est développé par Agbaya Group pour répondre aux besoins réels des équipes IT africaines : simplicité, fiabilité, multi-devises et support des paiements mobiles locaux.
          </p>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #534AB7, #7C3AED, #1D9E75)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-black text-white mb-4" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>
            Prêt à sécuriser votre gouvernance IT ?
          </h2>
          <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Rejoignez des équipes IT qui font confiance à Tracix. Gratuit pour commencer, sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={openRegister} className="group inline-flex items-center gap-3 px-8 py-4 bg-white rounded-2xl text-base font-black transition-all shadow-2xl hover:scale-105"
              style={{ color: '#534AB7' }}>
              Démarrer maintenant — c'est gratuit
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="mailto:contact@agbayagroup.com" className="inline-flex items-center justify-center px-8 py-4 rounded-2xl text-base font-bold border border-white/30 text-white hover:bg-white/10 transition-all">
              Parler à un expert
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '48px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="Tracix" style={{ height: 28, width: 'auto' }} />
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                La gouvernance des accès, simple et accessible pour les organisations en Afrique de l'Ouest.
              </p>
            </div>
            {[
              { title: 'Produit', links: ['Fonctionnalités', 'Tarifs', 'Intégrations', 'Sécurité'] },
              { title: 'Ressources', links: ['Documentation', 'API', 'Changelog', 'Status'] },
              { title: 'Légal', links: ['Confidentialité', 'CGU', 'Cookies', 'Contact'] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>{col.title}</h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <li key={l}><a href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }} className="sm:flex-row sm:justify-between">
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Agbaya Group. Tous droits réservés.</p>
          </div>
        </div>
      </footer>

      {/* ── Auth Modal ── */}
      {showLoginModal && (
        <AuthModal
          defaultTab={modalDefaultTab}
          onLogin={onLogin}
          onLoginWithMfa={onLoginWithMfa}
          onRegister={onRegister}
          onClose={() => setShowLoginModal(false)}
          onOpenSso={() => { setShowLoginModal(false); setShowSsoModal(true); }}
        />
      )}

      {showSsoModal && <SsoLoginModal onClose={() => setShowSsoModal(false)} />}
    </div>
  );
}

// ── SVG OAuth logos ───────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/>
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/>
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

// ── SSO Modal ─────────────────────────────────────────────────────────────────

function SsoLoginModal({ onClose }: { onClose: () => void }) {
  const [orgId, setOrgId] = useState('');
  const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0F1E, #0A0A16)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="p-8">
          <div className="w-10 h-10 rounded-xl bg-[#534AB7]/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-5 h-5 text-[#818CF8]" />
          </div>
          <h2 className="text-lg font-black text-white text-center mb-1">Connexion SSO</h2>
          <p className="text-xs text-white/35 text-center mb-6">Entrez l'identifiant de votre organisation</p>
          <div className="space-y-3">
            <input type="text" value={orgId} onChange={e => setOrgId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && orgId.trim() && (window.location.href = `${BASE}/saml/${orgId.trim()}/login`)}
              className="w-full px-3 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
              placeholder="ex: abc123 ou votre-org-id" autoFocus />
            <button onClick={() => orgId.trim() && (window.location.href = `${BASE}/saml/${orgId.trim()}/login`)}
              disabled={!orgId.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
              <ArrowRight className="w-4 h-4" /> Continuer avec SSO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────────────────────

interface AuthModalProps {
  defaultTab: 'login' | 'register';
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onLoginWithMfa: (userId: string, totp: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
  onRegister: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
  onOpenSso?: () => void;
}

function AuthModal({ defaultTab, onLogin, onLoginWithMfa, onRegister, onClose, onOpenSso }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0F1E, #0A0A16)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 opacity-20 blur-3xl rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, #534AB7, transparent)' }} />
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="px-8 pt-8 pb-0 text-center">
          <img src="/logo.png" alt="Tracix" className="w-10 h-10 object-contain mx-auto mb-3" />
          <h2 className="text-xl font-black text-white">
            {tab === 'login' ? 'Connexion à Tracix' : 'Créer un compte'}
          </h2>
          <p className="text-xs text-white/35 mt-1 mb-6">
            {tab === 'login' ? 'Accédez à votre espace de gouvernance' : 'Gratuit · Sans carte bancaire'}
          </p>
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button onClick={() => setTab('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'login' ? 'bg-[#534AB7] text-white' : 'text-white/40 hover:text-white/70'}`}>
              Se connecter
            </button>
            <button onClick={() => setTab('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'register' ? 'bg-[#534AB7] text-white' : 'text-white/40 hover:text-white/70'}`}>
              S'inscrire
            </button>
          </div>
        </div>
        <div className="px-8 pb-8">
          <div className="space-y-2.5 mb-5">
            {[
              { provider: 'google' as const, label: 'Continuer avec Google', logo: <GoogleLogo /> },
              { provider: 'microsoft' as const, label: 'Continuer avec Microsoft', logo: <MicrosoftLogo /> },
              { provider: 'github' as const, label: 'Continuer avec GitHub', logo: <GitHubLogo /> },
            ].map(({ provider, label, logo }) => (
              <a key={provider} href={api.auth.oauthUrl(provider)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all text-sm font-medium text-white/80 hover:text-white">
                <span className="flex-shrink-0">{logo}</span>
                <span className="flex-1 text-center">{label}</span>
              </a>
            ))}
            {onOpenSso && (
              <button type="button" onClick={onOpenSso}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium"
                style={{ borderColor: 'rgba(83,74,183,0.3)', background: 'rgba(83,74,183,0.08)', color: '#818CF8' }}>
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-center">Se connecter via SSO</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/25 font-medium">ou avec votre email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          {tab === 'login'
            ? <LoginForm onLogin={onLogin} onLoginWithMfa={onLoginWithMfa} />
            : <RegisterForm onRegister={onRegister} />
          }
          <p className="text-center text-xs text-white/20 mt-4 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" /> Connexion sécurisée — données chiffrées
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Login Form ────────────────────────────────────────────────────────────────

function LoginForm({ onLogin, onLoginWithMfa }: {
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onLoginWithMfa: (userId: string, totp: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [totp, setTotp] = useState('');
  const [forgotStep, setForgotStep] = useState<'idle' | 'form' | 'sent'>('idle');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onLogin(email, password);
      if ('mfa_required' in result) {
        setMfaUserId(result.user_id);
      } else if ('ok' in result && !result.ok) {
        setError((result as { ok: false; error?: string }).error ?? 'Email ou mot de passe incorrect.');
      }
    } catch {
      setError('Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaUserId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onLoginWithMfa(mfaUserId, totp);
      if (!result.ok) { setError(result.error ?? 'Code incorrect.'); setTotp(''); }
    } catch {
      setError('Code incorrect ou expiré.'); setTotp('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try { await api.auth.forgotPassword(forgotEmail); } catch { /* */ } finally {
      setForgotStep('sent'); setForgotLoading(false);
    }
  };

  if (mfaUserId) return (
    <form onSubmit={handleMfa} className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#534AB7]/10 border border-[#534AB7]/20">
        <KeyRound className="w-5 h-5 text-[#8B82D4] flex-shrink-0" />
        <div><p className="text-sm font-semibold text-white">Vérification en 2 étapes</p><p className="text-xs text-white/40">Code de votre application authenticator</p></div>
      </div>
      {error && <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 flex items-center gap-2"><X className="w-4 h-4" />{error}</div>}
      <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))} autoFocus
        className="w-full py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white text-center font-mono tracking-[0.4em] placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
        placeholder="000000" required />
      <button type="submit" disabled={isSubmitting || totp.length !== 6}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
        {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Vérification…</> : <>Confirmer <ArrowRight className="w-4 h-4" /></>}
      </button>
      <button type="button" onClick={() => { setMfaUserId(null); setTotp(''); setError(null); }} className="w-full text-xs text-white/30 hover:text-white/60 transition-colors">← Retour</button>
    </form>
  );

  if (forgotStep === 'form') return (
    <div className="space-y-4">
      <button onClick={() => setForgotStep('idle')} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
        <ArrowRight className="w-3 h-3 rotate-180" /> Retour
      </button>
      <form onSubmit={handleForgot} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
            placeholder="vous@entreprise.com" />
        </div>
        <button type="submit" disabled={forgotLoading}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
          {forgotLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi…</> : <>Envoyer le lien <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </div>
  );

  if (forgotStep === 'sent') return (
    <div className="space-y-4 text-center">
      <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
        <CheckCircle className="w-6 h-6 text-green-400" />
      </div>
      <p className="text-sm text-white/70">Si un compte existe pour <span className="text-white font-medium">{forgotEmail}</span>, un email a été envoyé.</p>
      <button onClick={() => { setForgotStep('idle'); setForgotEmail(''); }} className="text-xs text-[#8B82D4] hover:text-white transition-colors">← Retour à la connexion</button>
    </div>
  );

  return (
    <form onSubmit={handleCredentials} className="space-y-3.5">
      {error && <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 flex items-center gap-2"><X className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
            placeholder="vous@entreprise.com" required autoFocus />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-white/40">Mot de passe</label>
          <button type="button" onClick={() => { setForgotEmail(email); setForgotStep('form'); }} className="text-xs text-white/30 hover:text-[#8B82D4] transition-colors">Oublié ?</button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
            placeholder="••••••••" required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={isSubmitting}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 30px rgba(83,74,183,0.25)' }}>
        {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Connexion…</> : <>Se connecter <ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  );
}

// ── Register Form ─────────────────────────────────────────────────────────────

function RegisterForm({ onRegister }: { onRegister: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }> }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', organization_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Le mot de passe doit avoir au moins 8 caractères.'); return; }
    setError(null);
    setIsSubmitting(true);
    const result = await onRegister(form);
    if (!result.success) { setError(result.error ?? "Erreur lors de l'inscription."); setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 flex items-center gap-2"><X className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5">Nom complet</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="text" value={form.full_name} onChange={set('full_name')}
              className="w-full pl-10 pr-3 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
              placeholder="Kofi Mensah" required autoFocus />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5">Organisation</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="text" value={form.organization_name} onChange={set('organization_name')}
              className="w-full pl-10 pr-3 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
              placeholder="Mon entreprise" required />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type="email" value={form.email} onChange={set('email')}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
            placeholder="vous@entreprise.com" required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Mot de passe <span className="text-white/25 font-normal">(8 min)</span></label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none"
            placeholder="••••••••" required minLength={8} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={isSubmitting}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 30px rgba(83,74,183,0.25)' }}>
        {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création…</> : <>Créer mon compte <ArrowRight className="w-4 h-4" /></>}
      </button>
      <p className="text-center text-[11px] text-white/20">
        En créant un compte, vous acceptez nos <a href="#" className="text-white/40 hover:text-white/60 underline">CGU</a> et notre <a href="#" className="text-white/40 hover:text-white/60 underline">politique de confidentialité</a>.
      </p>
    </form>
  );
}
