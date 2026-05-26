import { useState } from 'react';
import {
  Crown, Zap, Check, Loader2, CreditCard, ArrowLeft,
  ArrowRight, Smartphone, Shield, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─── Data ───────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'pro' as const,
    label: 'Pro',
    tagline: 'Pour les équipes en croissance',
    icon: Zap,
    color: '#534AB7',
    gradient: 'from-[#534AB7] to-[#7C3AED]',
    priceMonthly: 30_000,
    features: [
      'Membres illimités',
      'Plateformes illimitées',
      '10 sièges utilisateurs',
      'Export CSV / Excel',
      'Modules personnalisés',
      'Rapports IA',
      'Alertes email',
    ],
  },
  {
    id: 'enterprise' as const,
    label: 'Enterprise',
    tagline: 'Pour les organisations exigeantes',
    icon: Crown,
    color: '#F59E0B',
    gradient: 'from-[#F59E0B] to-[#EF4444]',
    priceMonthly: 90_000,
    features: [
      'Tout le plan Pro',
      'Sièges illimités',
      'Multi-organisations',
      'SSO / SAML',
      'API REST complète',
      'Connecteurs (GitHub, Okta…)',
      'SLA garanti',
    ],
  },
];

interface Duration {
  months: number;
  label: string;
  sublabel: string;
  discount: number;
  badge?: string;
  badgeColor?: string;
}

const DURATIONS: Duration[] = [
  { months: 1,  label: '1 mois',  sublabel: 'Mensuel',     discount: 0 },
  { months: 3,  label: '3 mois',  sublabel: 'Trimestriel', discount: 5 },
  { months: 6,  label: '6 mois',  sublabel: 'Semestriel',  discount: 10 },
  { months: 12, label: '1 an',    sublabel: 'Annuel',      discount: 20, badge: 'Populaire',    badgeColor: '#534AB7' },
  { months: 24, label: '2 ans',   sublabel: 'Biannuel',    discount: 30, badge: '-30%',         badgeColor: '#10B981' },
  { months: 36, label: '3 ans',   sublabel: 'Triennal',    discount: 40, badge: 'Meilleur prix', badgeColor: '#F59E0B' },
];

const PAYMENT_METHODS = ['Wave CI', 'Orange Money', 'MTN MoMo', 'Moov Money', 'Visa', 'Mastercard'];

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ['Plan', 'Durée', 'Confirmation'];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: done
                    ? '#10B981'
                    : active
                    ? 'linear-gradient(135deg, #534AB7, #7C3AED)'
                    : 'rgba(255,255,255,0.08)',
                  color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
                  boxShadow: active ? '0 0 0 4px rgba(83,74,183,0.25)' : 'none',
                }}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className="text-[11px] font-medium"
                style={{ color: active ? '#fff' : done ? '#10B981' : 'rgba(255,255,255,0.3)' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-16 h-0.5 mb-5 mx-1 transition-all duration-500"
                style={{ background: done ? '#10B981' : 'rgba(255,255,255,0.1)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Plan ───────────────────────────────────────────────────────────

function StepPlan({
  selected,
  onSelect,
  onNext,
}: {
  selected: 'pro' | 'enterprise';
  onSelect: (p: 'pro' | 'enterprise') => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-white mb-1 text-center">Choisissez votre plan</h2>
      <p className="text-white/40 text-sm text-center mb-8">Changez de plan à tout moment</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const active = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className="relative rounded-2xl p-6 border text-left transition-all duration-200 group"
              style={{
                background: active ? `${plan.color}15` : 'rgba(255,255,255,0.03)',
                borderColor: active ? plan.color : 'rgba(255,255,255,0.08)',
                boxShadow: active ? `0 0 0 1px ${plan.color}` : 'none',
              }}
            >
              {active && (
                <div
                  className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: plan.color }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${plan.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: plan.color }} />
              </div>

              <p className="font-black text-white text-lg mb-0.5">{plan.label}</p>
              <p className="text-white/40 text-xs mb-4">{plan.tagline}</p>

              <div className="mb-4">
                <span className="text-2xl font-black text-white">
                  {plan.priceMonthly.toLocaleString('fr-FR')}
                </span>
                <span className="text-white/40 text-sm ml-1">XOF / mois</span>
              </div>

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                    <Check className="w-3 h-3 flex-shrink-0" style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
      >
        Continuer
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 2 — Durée ──────────────────────────────────────────────────────────

function StepDuree({
  plan,
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  plan: typeof PLANS[number];
  selected: number;
  onSelect: (m: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-white mb-1 text-center">Durée de l'abonnement</h2>
      <p className="text-white/40 text-sm text-center mb-8">
        Plus longtemps, plus d'économies. Renouvellement garanti au même prix.
      </p>

      <div className="space-y-3 mb-8">
        {DURATIONS.map((d) => {
          const active = selected === d.months;
          const base = plan.priceMonthly * d.months;
          const discountAmt = Math.round(base * d.discount / 100);
          const total = base - discountAmt;
          const perMonth = Math.round(total / d.months);

          return (
            <button
              key={d.months}
              onClick={() => onSelect(d.months)}
              className="relative w-full rounded-xl px-5 py-4 border text-left flex items-center justify-between transition-all duration-200"
              style={{
                background: active ? 'rgba(83,74,183,0.12)' : 'rgba(255,255,255,0.03)',
                borderColor: active ? '#534AB7' : 'rgba(255,255,255,0.08)',
                boxShadow: active ? '0 0 0 1px #534AB7' : 'none',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    borderColor: active ? '#534AB7' : 'rgba(255,255,255,0.2)',
                    background: active ? '#534AB7' : 'transparent',
                  }}
                >
                  {active && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{d.label}</span>
                    <span className="text-white/30 text-xs">{d.sublabel}</span>
                    {d.badge && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: d.badgeColor }}
                      >
                        {d.badge}
                      </span>
                    )}
                  </div>
                  {d.discount > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: '#10B981' }}>
                      Économisez {discountAmt.toLocaleString('fr-FR')} XOF (-{d.discount}%)
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-white font-black">{total.toLocaleString('fr-FR')} XOF</p>
                {d.months > 1 && (
                  <p className="text-white/30 text-xs">{perMonth.toLocaleString('fr-FR')} XOF/mois</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-4 rounded-2xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
        >
          Continuer
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Confirmation ────────────────────────────────────────────────────

function StepConfirmation({
  plan,
  duration,
  onBack,
  onPay,
  loading,
}: {
  plan: typeof PLANS[number];
  duration: Duration;
  onBack: () => void;
  onPay: () => void;
  loading: boolean;
}) {
  const Icon = plan.icon;
  const base = plan.priceMonthly * duration.months;
  const discountAmt = Math.round(base * duration.discount / 100);
  const total = base - discountAmt;
  const perMonth = Math.round(total / duration.months);

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-1 text-center">Confirmer votre commande</h2>
      <p className="text-white/40 text-sm text-center mb-8">Vérifiez les détails avant de payer</p>

      {/* Récap visuel */}
      <div
        className="rounded-2xl p-5 mb-4 relative overflow-hidden"
        style={{ background: `${plan.color}12`, border: `1px solid ${plan.color}30` }}
      >
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-5 -translate-y-10 translate-x-10"
          style={{ background: plan.color }}
        />
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${plan.color}25` }}
          >
            <Icon className="w-5 h-5" style={{ color: plan.color }} />
          </div>
          <div>
            <p className="text-white font-bold">Tracix {plan.label}</p>
            <p className="text-white/40 text-xs">{duration.label} · {duration.sublabel}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-white/50">
            <span>{plan.label} × {duration.months} mois</span>
            <span>{base.toLocaleString('fr-FR')} XOF</span>
          </div>
          {duration.discount > 0 && (
            <div className="flex justify-between" style={{ color: '#10B981' }}>
              <span>Remise -{duration.discount}%</span>
              <span>-{discountAmt.toLocaleString('fr-FR')} XOF</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between text-white font-black text-base" style={{ borderColor: `${plan.color}30` }}>
            <span>Total</span>
            <span>{total.toLocaleString('fr-FR')} XOF</span>
          </div>
          {duration.months > 1 && (
            <p className="text-white/30 text-xs text-right">
              soit {perMonth.toLocaleString('fr-FR')} XOF/mois
            </p>
          )}
        </div>
      </div>

      {/* Garantie renouvellement */}
      <div className="flex items-start gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-3 mb-4">
        <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/50">
          Renouvellement au <span className="text-white font-semibold">même tarif garanti</span>. Aucune surprise à l'échéance.
        </p>
      </div>

      {/* Méthodes de paiement */}
      <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 mb-6">
        <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> Méthodes acceptées
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <span
              key={m}
              className="text-[11px] bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-white/50"
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-4 rounded-2xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={onPay}
          disabled={loading}
          className="flex-1 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${plan.color}, #7C3AED)` }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CreditCard className="w-5 h-5" />
          )}
          {loading ? 'Redirection…' : `Payer ${total.toLocaleString('fr-FR')} XOF`}
        </button>
      </div>

      <p className="text-center text-xs text-white/20 mt-4 flex items-center justify-center gap-1">
        <Shield className="w-3 h-3" />
        Paiement sécurisé par FedaPay. Aucune donnée bancaire stockée.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PaiementProps {
  currentPlan: string;
  onBack: () => void;
}

export function Paiement({ currentPlan, onBack }: PaiementProps) {
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>(
    currentPlan === 'enterprise' ? 'enterprise' : 'pro',
  );
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const duration = DURATIONS.find((d) => d.months === months)!;

  async function handlePay() {
    setLoading(true);
    try {
      const res = await api.fedapay.initiate({ plan: selectedPlan, months });
      window.location.href = res.payment_url;
    } catch {
      toast.error("Erreur lors de l'initialisation du paiement. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0A16] flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between">
        <button
          onClick={step === 0 ? onBack : () => setStep(step - 1)}
          className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Retour' : ''}
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
          >
            <ChevronRight className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Tracix</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-[#0F0E1A] border border-white/8 rounded-3xl p-8 shadow-2xl">
        <StepBar current={step} />

        {step === 0 && (
          <StepPlan
            selected={selectedPlan}
            onSelect={setSelectedPlan}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepDuree
            plan={plan}
            selected={months}
            onSelect={setMonths}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepConfirmation
            plan={plan}
            duration={duration}
            onBack={() => setStep(1)}
            onPay={handlePay}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
