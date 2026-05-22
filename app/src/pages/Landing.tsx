// ═══════════════════════════════════════════
// Landing Page — Tracix by Agbaya Group
// ═══════════════════════════════════════════

import { useState } from 'react';
import {
  Shield, ArrowRight, CheckCircle, Users, BarChart2, Bell,
  GitBranch, Lock, Mail, Eye, EyeOff, Menu, X,
  Zap, Star, Crown, TrendingUp, FileText, ChevronRight,
  AlertTriangle, Activity, Database, Building2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface LandingProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }>;
}

const FEATURES = [
  {
    icon: GitBranch,
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/25',
    title: 'Gestion des habilitations',
    desc: 'Visualisez et contrôlez tous les droits d\'accès en une matrice claire. Qui a accès à quoi, depuis quand.',
  },
  {
    icon: BarChart2,
    gradient: 'from-emerald-400 to-teal-600',
    glow: 'shadow-emerald-500/25',
    title: 'Score de risque intelligent',
    desc: 'Chaque membre reçoit un score 0-100 calculé en temps réel selon ses accès, son statut et ses revues.',
  },
  {
    icon: Bell,
    gradient: 'from-red-400 to-rose-600',
    glow: 'shadow-red-500/25',
    title: 'Alertes automatiques',
    desc: 'Détection proactive : comptes sans MFA, accès orphelins, abonnements expirants, départs non traités.',
  },
  {
    icon: Users,
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    title: 'Annuaire des membres',
    desc: 'Gérez collaborateurs et équipes. Suivez l\'offboarding sans jamais oublier de révoquer un accès.',
  },
  {
    icon: TrendingUp,
    gradient: 'from-blue-400 to-indigo-600',
    glow: 'shadow-blue-500/25',
    title: 'Suivi des abonnements',
    desc: 'Centralisez vos SaaS, coûts et renouvellements. Multi-devises avec conversion automatique.',
  },
  {
    icon: FileText,
    gradient: 'from-pink-400 to-fuchsia-600',
    glow: 'shadow-pink-500/25',
    title: 'Modules personnalisés',
    desc: 'Créez vos propres espaces : contacts, procédures, KPIs, notes. Adaptés à votre organisation.',
  },
];

const STATS = [
  { value: '100%', label: 'Sécurisé', icon: Shield },
  { value: '<2min', label: 'Pour démarrer', icon: Zap },
  { value: '7+', label: 'Types d\'alertes', icon: Bell },
  { value: '4', label: 'Devises', icon: Activity },
];

const PLANS = [
  {
    id: 'free', label: 'Starter', price: '0', period: '€ / mois',
    icon: Zap, color: '#6B7280',
    desc: 'Découvrez Tracix sans engagement',
    highlight: false,
    badge: null,
    features: ['10 membres', '3 plateformes', 'Alertes automatiques', 'Score de risque', 'Journal d\'audit'],
    missing: ['Export XLSX', 'Modules personnalisés'],
    cta: 'Commencer gratuitement',
  },
  {
    id: 'pro', label: 'Pro', price: '49', period: '€ / mois',
    icon: Star, color: '#534AB7',
    desc: 'Pour les équipes IT actives',
    highlight: true,
    badge: 'LE PLUS POPULAIRE',
    features: ['Membres illimités', 'Plateformes illimitées', 'Modules personnalisés', 'Export XLSX', 'Toutes les intégrations', 'Support prioritaire'],
    missing: [],
    cta: 'Démarrer l\'essai',
  },
  {
    id: 'enterprise', label: 'Enterprise', price: 'Sur', period: 'devis',
    icon: Crown, color: '#EF9F27',
    desc: 'Pour les grandes organisations',
    highlight: false,
    badge: null,
    features: ['Tout le plan Pro', 'Multi-organisations', 'SSO / LDAP', 'API REST complète', 'Marque blanche', 'SLA garanti'],
    missing: [],
    cta: 'Nous contacter',
  },
];

const TESTIMONIALS = [
  {
    name: 'Kader K.', role: 'DSI — Fintech Abidjan', avatar: 'K', color: '#534AB7',
    text: 'Tracix nous a permis de réduire notre surface d\'attaque de 40% en 2 semaines. La gestion des habilitations est enfin centralisée.',
    stars: 5,
  },
  {
    name: 'Marie T.', role: 'RSSI — Groupe distribution Dakar', avatar: 'M', color: '#1D9E75',
    text: 'Le score de risque automatique m\'évite des heures d\'audit manuel. Je reçois les alertes avant que les problèmes surviennent.',
    stars: 5,
  },
  {
    name: 'Roland N.', role: 'IT Manager — ONG Douala', avatar: 'R', color: '#EF9F27',
    text: 'Interface claire, données bien organisées. On a enfin une vue complète de qui a accès à quoi dans notre organisation.',
    stars: 5,
  },
];

export function Landing({ onLogin, onRegister }: LandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<'login' | 'register'>('login');

  const openLogin = () => { setModalDefaultTab('login'); setShowLoginModal(true); };
  const openRegister = () => { setModalDefaultTab('register'); setShowLoginModal(true); };

  return (
    <div className="min-h-screen bg-[#07070F] text-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#07070F]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5 group">
            <img src="/favicon.png" alt="Tracix" className="w-8 h-8 object-contain" />
            <div>
              <span className="font-bold text-white text-base leading-none block">Tracix</span>
              <span className="text-[9px] text-white/30 block">by Agbaya Group</span>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {[['Fonctionnalités', '#features'], ['Tarifs', '#pricing'], ['À propos', '#about']].map(([l, h]) => (
              <a key={h} href={h} className="text-sm text-white/60 hover:text-white transition-colors font-medium">{l}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={openLogin} className="text-sm text-white/60 hover:text-white transition-colors px-3 py-2">
              Se connecter
            </button>
            <button
              onClick={openRegister}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
            >
              Démarrer gratuitement
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5 text-white/70" /> : <Menu className="w-5 h-5 text-white/70" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0D0D1A] border-t border-white/5 px-4 py-4 space-y-1">
            {[['Fonctionnalités', '#features'], ['Tarifs', '#pricing'], ['À propos', '#about']].map(([l, h]) => (
              <a key={h} href={h} onClick={() => setMobileMenuOpen(false)} className="block text-sm text-white/70 py-2.5 font-medium border-b border-white/5">{l}</a>
            ))}
            <button onClick={() => { openRegister(); setMobileMenuOpen(false); }} className="w-full mt-3 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
              Démarrer gratuitement
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Background glow blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: 'radial-gradient(circle, #534AB7, transparent)' }} />
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]" style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
          <div className="absolute bottom-0 left-1/2 w-[500px] h-[300px] rounded-full opacity-10 blur-[100px]" style={{ background: 'radial-gradient(circle, #1D9E75, transparent)' }} />
          {/* Grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(83,74,183,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.07) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div className="relative max-w-6xl mx-auto text-center">

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            Prenez le contrôle{' '}
            <br />
            <span className="relative inline-block">
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #818CF8, #534AB7, #A78BFA)' }}>
                de vos accès IT
              </span>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Tracix centralise la gestion des habilitations, détecte les risques en temps réel et alerte votre équipe avant que les incidents surviennent.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={openRegister}
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 hover:shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 40px rgba(83,74,183,0.4)' }}
            >
              Démarrer gratuitement
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold border border-white/10 text-white/70 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
            >
              Voir les fonctionnalités
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8 mb-16">
            {STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#818CF8]" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black text-white leading-none">{s.value}</p>
                    <p className="text-[11px] text-white/40">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* App mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl" style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED, #1D9E75)' }} />
            <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ background: 'linear-gradient(180deg, #0F0F1E, #0A0A16)' }}>
              {/* Fake browser bar */}
              <div className="h-9 bg-white/5 border-b border-white/5 flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="mx-4 flex-1 h-5 rounded-md bg-white/5 max-w-xs flex items-center px-3 gap-2">
                  <Lock className="w-2.5 h-2.5 text-green-400/70" />
                  <span className="text-[10px] text-white/30">tracix.io/dashboard</span>
                </div>
              </div>
              {/* App interior */}
              <div className="flex h-72 sm:h-96">
                {/* Sidebar */}
                <div className="w-44 border-r border-white/5 p-3 space-y-0.5 hidden sm:block flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 p-2 mb-4">
                    <img src="/favicon.png" className="w-6 h-6 object-contain" alt="" />
                    <span className="text-xs font-bold text-white">Tracix</span>
                  </div>
                  {[
                    { l: 'Dashboard', active: true },
                    { l: 'Habilitations', active: false },
                    { l: 'Membres', active: false },
                    { l: 'Score de risque', active: false },
                    { l: 'Alertes', active: false },
                    { l: 'Abonnements', active: false },
                    { l: 'Paramètres', active: false },
                  ].map((item) => (
                    <div key={item.l} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${item.active ? 'bg-[#534AB7]/20 text-[#A89FF0] font-semibold' : 'text-white/30'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-[#534AB7]' : 'bg-white/10'}`} />
                      {item.l}
                    </div>
                  ))}
                </div>
                {/* Dashboard content */}
                <div className="flex-1 p-5">
                  <p className="text-[11px] text-white/30 mb-4 font-semibold uppercase tracking-wider">Vue d'ensemble</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Score moyen', value: '74', sub: 'Conforme', color: '#1D9E75', bg: 'rgba(29,158,117,0.1)' },
                      { label: 'Alertes actives', value: '3', sub: 'Critiques', color: '#E24B4A', bg: 'rgba(226,75,74,0.1)' },
                      { label: 'Membres actifs', value: '8', sub: 'Sur 10 total', color: '#818CF8', bg: 'rgba(129,140,248,0.1)' },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-3 border border-white/5" style={{ background: card.bg }}>
                        <p className="text-[9px] text-white/40 mb-1.5">{card.label}</p>
                        <p className="text-2xl font-black" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[9px] text-white/30 mt-0.5">{card.sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Revues dépassées', value: '2', color: '#EF9F27' },
                      { label: 'Abonnements suivis', value: '6', color: '#3B82F6' },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-3 border border-white/5 bg-white/2">
                        <p className="text-[9px] text-white/40 mb-1">{card.label}</p>
                        <p className="text-xl font-black" style={{ color: card.color }}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-white/5 p-3" style={{ background: 'rgba(226,75,74,0.05)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <p className="text-[10px] text-white/50 font-semibold">Alertes récentes</p>
                    </div>
                    {['Élodie T. — Départ non traité', 'Cloudflare — Renouvellement dans 8j'].map((a) => (
                      <div key={a} className="flex items-center gap-2 py-1">
                        <div className="w-1 h-1 rounded-full bg-red-400" />
                        <p className="text-[10px] text-white/40">{a}</p>
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
      <div className="py-10 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-6">Fait pour les équipes IT de</p>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-12">
            {['Côte d\'Ivoire 🇨🇮', 'Sénégal 🇸🇳', 'Cameroun 🇨🇲', 'Bénin 🇧🇯', 'France 🇫🇷', 'Et partout ailleurs 🌍'].map((c) => (
              <span key={c} className="text-sm text-white/30 hover:text-white/60 transition-colors font-medium">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-[#818CF8] font-bold uppercase tracking-widest mb-4">Fonctionnalités</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
              Tout ce dont votre équipe IT
              <br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #818CF8, #534AB7)' }}>
                a réellement besoin
              </span>
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              Une plateforme complète pour gouverner vos accès, réduire vos risques et rester conforme.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group relative p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))' }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(83,74,183,0.08), transparent 70%)' }} />
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg ${f.glow}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2.5">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[120px]" style={{ background: 'radial-gradient(circle, #534AB7, transparent)' }} />
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-[#818CF8] font-bold uppercase tracking-widest mb-4">Simple par conception</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5">Opérationnel en 3 étapes</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Créez votre organisation', desc: 'Inscrivez-vous, nommez votre org et invitez votre équipe en moins de 2 minutes.', icon: Database, color: '#534AB7' },
              { num: '02', title: 'Importez vos données', desc: 'Ajoutez membres, plateformes et droits d\'accès manuellement ou via import CSV.', icon: Users, color: '#1D9E75' },
              { num: '03', title: 'Pilotez et sécurisez', desc: 'Les alertes s\'activent, les scores se calculent. Vous gardez le contrôle en temps réel.', icon: Shield, color: '#EF9F27' },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative text-center p-8 rounded-2xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-7xl font-black mb-5 select-none" style={{ color: `${step.color}15` }}>{step.num}</div>
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${step.color}20` }}>
                    <Icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-4 sm:px-6 border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-[#818CF8] font-bold uppercase tracking-widest mb-4">Témoignages</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Ils font confiance à Tracix</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-white/5 flex flex-col" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))' }}>
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-white/60 leading-relaxed flex-1 mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}99)` }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-white/30">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-[#818CF8] font-bold uppercase tracking-widest mb-4">Tarifs</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5">Simples et transparents</h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-7 border flex flex-col transition-all ${
                    plan.highlight
                      ? 'border-[#534AB7] shadow-2xl'
                      : 'border-white/5 hover:border-white/10'
                  }`}
                  style={plan.highlight ? {
                    background: 'linear-gradient(135deg, rgba(83,74,183,0.15), rgba(124,58,237,0.08))',
                    boxShadow: '0 0 60px rgba(83,74,183,0.2)',
                  } : {
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                  }}
                >
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-black text-white" style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
                      {plan.badge}
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${plan.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: plan.color }} />
                    </div>
                    <span className="font-black text-white text-lg">{plan.label}</span>
                  </div>
                  <div className="mb-1 flex items-end gap-1">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-sm text-white/30 mb-1.5">{plan.period}</span>
                  </div>
                  <p className="text-xs text-white/40 mb-6">{plan.desc}</p>
                  <ul className="space-y-3 flex-1 mb-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/20 line-through">
                        <X className="w-4 h-4 text-white/15 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => plan.id !== 'enterprise' && openRegister()}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                      plan.highlight
                        ? 'text-white hover:opacity-90 hover:scale-[1.02]'
                        : 'border border-white/10 text-white/70 hover:text-white hover:border-white/20 hover:bg-white/5'
                    }`}
                    style={plan.highlight ? { background: 'linear-gradient(135deg, #534AB7, #7C3AED)' } : {}}
                  >
                    {plan.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="py-24 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <img src="/favicon.png" alt="Tracix" className="w-16 h-16 object-contain mx-auto mb-6" />
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
            Conçu pour l'Afrique,
            <br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #818CF8, #534AB7)' }}>
              pensé pour le monde
            </span>
          </h2>
          <p className="text-lg text-white/40 leading-relaxed max-w-2xl mx-auto">
            Tracix est développé par Agbaya Group pour répondre aux besoins réels des équipes IT africaines : simplicité, fiabilité, multi-devises et support des paiements mobiles locaux.
          </p>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED, #1D9E75)' }} />
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Prêt à sécuriser votre gouvernance IT ?
          </h2>
          <p className="text-white/70 text-lg mb-8">
            Rejoignez des équipes IT qui font confiance à Tracix. Gratuit pour commencer, sans carte bancaire.
          </p>
          <button
            onClick={openRegister}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-[#534AB7] rounded-2xl text-base font-black hover:bg-gray-50 transition-all shadow-2xl hover:scale-105"
          >
            Démarrer maintenant — c'est gratuit
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 sm:px-6 border-t border-white/5 bg-black/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="Tracix" className="w-7 h-7 object-contain" />
            <span className="text-white font-bold">Tracix</span>
            <span className="text-white/20 text-xs">by Agbaya Group</span>
          </div>
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Agbaya Group. Tous droits réservés.</p>
          <div className="flex gap-6 text-xs text-white/30">
            <a href="#" className="hover:text-white/60 transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-white/60 transition-colors">CGU</a>
            <a href="mailto:contact@agbayagroup.com" className="hover:text-white/60 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* ── Auth Modal ── */}
      {showLoginModal && (
        <AuthModal
          defaultTab={modalDefaultTab}
          onLogin={onLogin}
          onRegister={onRegister}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}

// ── SVG logos pour les fournisseurs OAuth ──

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

// ── Modal d'authentification (Connexion + Inscription) ──

interface AuthModalProps {
  defaultTab: 'login' | 'register';
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

function AuthModal({ defaultTab, onLogin, onRegister, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0F1E, #0A0A16)' }}
      >
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 opacity-20 blur-3xl rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #534AB7, transparent)' }} />

        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-0 text-center">
          <img src="/favicon.png" alt="Tracix" className="w-10 h-10 object-contain mx-auto mb-3" />
          <h2 className="text-xl font-black text-white">
            {tab === 'login' ? 'Connexion à Tracix' : 'Créer un compte'}
          </h2>
          <p className="text-xs text-white/35 mt-1 mb-6">
            {tab === 'login' ? 'Accédez à votre espace de gouvernance' : 'Gratuit · Sans carte bancaire'}
          </p>

          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'login' ? 'bg-[#534AB7] text-white shadow' : 'text-white/40 hover:text-white/70'}`}
            >
              Se connecter
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'register' ? 'bg-[#534AB7] text-white shadow' : 'text-white/40 hover:text-white/70'}`}
            >
              S'inscrire
            </button>
          </div>
        </div>

        <div className="px-8 pb-8">
          {/* OAuth Buttons */}
          <div className="space-y-2.5 mb-5">
            {[
              { provider: 'google' as const, label: 'Continuer avec Google', logo: <GoogleLogo /> },
              { provider: 'microsoft' as const, label: 'Continuer avec Microsoft', logo: <MicrosoftLogo /> },
              { provider: 'github' as const, label: 'Continuer avec GitHub', logo: <GitHubLogo /> },
            ].map(({ provider, label, logo }) => (
              <a
                key={provider}
                href={api.auth.oauthUrl(provider)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all text-sm font-medium text-white/80 hover:text-white"
              >
                <span className="flex-shrink-0">{logo}</span>
                <span className="flex-1 text-center">{label}</span>
              </a>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/25 font-medium">ou avec votre email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Forms */}
          {tab === 'login' ? (
            <LoginForm onLogin={onLogin} />
          ) : (
            <RegisterForm onRegister={onRegister} />
          )}

          <p className="text-center text-xs text-white/20 mt-4 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            Connexion sécurisée — données chiffrées
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire de connexion ──

function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<boolean> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const success = await onLogin(email, password);
      if (!success) setError('Email ou mot de passe incorrect.');
    } catch {
      setError('Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
            placeholder="vous@entreprise.com" required autoFocus />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Mot de passe</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
            placeholder="••••••••" required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={isSubmitting}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 30px rgba(83,74,183,0.25)' }}
      >
        {isSubmitting ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Connexion…</>
        ) : (
          <>Se connecter <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </form>
  );
}

// ── Formulaire d'inscription ──

function RegisterForm({ onRegister }: { onRegister: (data: { full_name: string; email: string; password: string; organization_name: string }) => Promise<{ success: boolean; error?: string }> }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', organization_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Le mot de passe doit avoir au moins 8 caractères.'); return; }
    setError(null);
    setIsSubmitting(true);
    const result = await onRegister(form);
    if (!result.success) {
      setError(result.error ?? 'Erreur lors de l\'inscription.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5">Nom complet</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="text" value={form.full_name} onChange={set('full_name')}
              className="w-full pl-10 pr-3 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
              placeholder="Kofi Mensah" required autoFocus />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/40 mb-1.5">Organisation</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="text" value={form.organization_name} onChange={set('organization_name')}
              className="w-full pl-10 pr-3 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
              placeholder="Mon entreprise" required />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type="email" value={form.email} onChange={set('email')}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
            placeholder="vous@entreprise.com" required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5">Mot de passe <span className="text-white/25 font-normal">(8 caractères min)</span></label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
            placeholder="••••••••" required minLength={8} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={isSubmitting}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 30px rgba(83,74,183,0.25)' }}
      >
        {isSubmitting ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création du compte…</>
        ) : (
          <>Créer mon compte <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
      <p className="text-center text-[11px] text-white/20 leading-relaxed">
        En créant un compte, vous acceptez nos{' '}
        <a href="#" className="text-white/40 hover:text-white/60 underline">CGU</a>
        {' '}et notre{' '}
        <a href="#" className="text-white/40 hover:text-white/60 underline">politique de confidentialité</a>.
      </p>
    </form>
  );
}
