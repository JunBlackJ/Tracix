import { useState } from 'react';
import { Crown, Zap, Check, Loader2, CreditCard, Smartphone, ArrowLeft, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'pro' as const,
    label: 'Pro',
    icon: Zap,
    color: '#534AB7',
    priceMonthly: 30_000,
    features: [
      'Membres illimités',
      'Plateformes illimitées',
      '10 sièges utilisateurs',
      'Export CSV/Excel',
      'Modules personnalisés',
      'Rapports IA',
      'Alertes email',
    ],
  },
  {
    id: 'enterprise' as const,
    label: 'Enterprise',
    icon: Crown,
    color: '#F59E0B',
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

interface DurationOption {
  months: number;
  label: string;
  sublabel: string;
  discount: number;
  badge?: string;
  badgeColor?: string;
}

const DURATION_OPTIONS: DurationOption[] = [
  { months: 1,  label: '1 mois',  sublabel: 'Mensuel',      discount: 0 },
  { months: 3,  label: '3 mois',  sublabel: 'Trimestriel',  discount: 5 },
  { months: 6,  label: '6 mois',  sublabel: 'Semestriel',   discount: 10 },
  { months: 12, label: '1 an',    sublabel: 'Annuel',       discount: 20, badge: 'Populaire',   badgeColor: '#534AB7' },
  { months: 24, label: '2 ans',   sublabel: 'Biannuel',     discount: 30, badge: '-30%',        badgeColor: '#10B981' },
  { months: 36, label: '3 ans',   sublabel: 'Triennal',     discount: 40, badge: 'Meilleur prix', badgeColor: '#F59E0B' },
];

interface PaiementProps {
  currentPlan: string;
  onBack: () => void;
}

export function Paiement({ currentPlan, onBack }: PaiementProps) {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>(
    currentPlan === 'enterprise' ? 'enterprise' : 'pro',
  );
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const duration = DURATION_OPTIONS.find((d) => d.months === months)!;
  const discount = duration.discount;
  const baseAmount = plan.priceMonthly * months;
  const discountAmount = Math.round(baseAmount * discount / 100);
  const finalAmount = baseAmount - discountAmount;
  const monthlyEffective = Math.round(finalAmount / months);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await api.payments.initiate({ plan: selectedPlan, months });
      window.location.href = res.payment_url;
    } catch {
      toast.error("Erreur lors de l'initialisation du paiement. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0E1A] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <h1 className="text-2xl font-black text-white mb-1">Choisir un plan</h1>
        <p className="text-white/40 text-sm mb-8">
          Paiement sécurisé via CinetPay — Wave, Orange Money, MTN, Moov, Visa
        </p>

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const active = selectedPlan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className="rounded-2xl p-5 border text-left transition-all"
                style={{
                  background: active ? `${p.color}18` : 'rgba(255,255,255,0.03)',
                  borderColor: active ? p.color : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}25` }}>
                    <Icon className="w-4 h-4" style={{ color: p.color }} />
                  </div>
                  <span className="font-bold text-white">{p.label}</span>
                  {active && (
                    <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center" style={{ background: p.color }}>
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-white mb-1">
                  {p.priceMonthly.toLocaleString('fr-FR')}{' '}
                  <span className="text-sm font-normal text-white/40">XOF/mois</span>
                </div>
                <p className="text-xs text-white/30 mb-3">Prix de référence mensuel</p>
                <ul className="space-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="w-3 h-3 shrink-0" style={{ color: p.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Durée */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 mb-6">
          <p className="text-sm font-semibold text-white/70 mb-1">Durée de l'abonnement</p>
          <p className="text-xs text-white/30 mb-4 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Le renouvellement se fait au même tarif — aucune surprise à l'échéance.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {DURATION_OPTIONS.map((opt) => {
              const active = months === opt.months;
              return (
                <button
                  key={opt.months}
                  onClick={() => setMonths(opt.months)}
                  className="relative rounded-xl py-3 px-2 text-center border transition-all"
                  style={{
                    background: active ? '#534AB718' : 'rgba(255,255,255,0.03)',
                    borderColor: active ? '#534AB7' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  {opt.badge && (
                    <span
                      className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                      style={{ background: opt.badgeColor }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  <div className="text-white font-bold text-sm mt-1">{opt.label}</div>
                  <div className="text-white/40 text-[10px]">{opt.sublabel}</div>
                  {opt.discount > 0 && (
                    <div className="text-xs mt-0.5 font-semibold" style={{ color: '#10B981' }}>
                      -{opt.discount}%
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Récapitulatif */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 mb-6">
          <p className="text-sm font-semibold text-white/70 mb-4">Récapitulatif</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/60">
              <span>
                {plan.label} × {months} mois ({plan.priceMonthly.toLocaleString('fr-FR')} XOF/mois)
              </span>
              <span>{baseAmount.toLocaleString('fr-FR')} XOF</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between" style={{ color: '#10B981' }}>
                <span>Remise engagement {duration.sublabel.toLowerCase()} (-{discount}%)</span>
                <span>-{discountAmount.toLocaleString('fr-FR')} XOF</span>
              </div>
            )}
            <div className="border-t border-white/8 pt-2 flex justify-between font-black text-white text-base">
              <span>Total à payer</span>
              <span>{finalAmount.toLocaleString('fr-FR')} XOF</span>
            </div>
            {months > 1 && (
              <div className="flex justify-between text-white/30 text-xs">
                <span>Soit par mois</span>
                <span>{monthlyEffective.toLocaleString('fr-FR')} XOF/mois</span>
              </div>
            )}
          </div>

          {months >= 12 && (
            <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400">
              Vous économisez{' '}
              <span className="font-bold">{discountAmount.toLocaleString('fr-FR')} XOF</span>{' '}
              par rapport au tarif mensuel. Renouvellement garanti au même prix.
            </div>
          )}
        </div>

        {/* Méthodes de paiement */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 mb-6">
          <p className="text-xs text-white/40 mb-3 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" /> Mobile Money & Carte bancaire acceptés
          </p>
          <div className="flex flex-wrap gap-2">
            {['Wave CI', 'Orange Money', 'MTN MoMo', 'Moov Money', 'Visa', 'Mastercard'].map((m) => (
              <span key={m} className="text-xs bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-white/50">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CreditCard className="w-5 h-5" />
          )}
          {loading
            ? 'Redirection vers CinetPay…'
            : `Payer ${finalAmount.toLocaleString('fr-FR')} XOF`}
        </button>

        <p className="text-center text-xs text-white/30 mt-4">
          Paiement sécurisé par CinetPay. Aucune donnée bancaire n'est stockée par Tracix.
        </p>
      </div>
    </div>
  );
}
