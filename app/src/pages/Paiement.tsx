import { useState } from 'react';
import { Crown, Zap, Check, Loader2, CreditCard, Smartphone, ArrowLeft } from 'lucide-react';
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

const MONTHS_OPTIONS = [1, 3, 6, 12];
const MONTH_DISCOUNTS: Record<number, number> = { 1: 0, 3: 5, 6: 10, 12: 20 };

interface PaiementProps {
  currentPlan: string;
  onBack: () => void;
}

export function Paiement({ currentPlan, onBack }: PaiementProps) {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>(
    currentPlan === 'enterprise' ? 'enterprise' : 'pro',
  );
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(false);

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const discount = MONTH_DISCOUNTS[months] ?? 0;
  const baseAmount = plan.priceMonthly * months;
  const discountAmount = Math.round(baseAmount * discount / 100);
  const finalAmount = baseAmount - discountAmount;

  async function handlePay() {
    setLoading(true);
    try {
      const res = await api.payments.initiate({ plan: selectedPlan, months });
      // Rediriger vers CinetPay
      window.location.href = res.payment_url;
    } catch (err) {
      toast.error('Erreur lors de l\'initialisation du paiement. Réessayez.');
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
        <p className="text-white/40 text-sm mb-8">Paiement sécurisé via CinetPay — Wave, Orange Money, MTN, Moov, Visa</p>

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
                <div className="text-xl font-black text-white mb-3">
                  {p.priceMonthly.toLocaleString('fr-FR')} <span className="text-sm font-normal text-white/40">XOF/mois</span>
                </div>
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
          <p className="text-sm font-semibold text-white/70 mb-3">Durée de l'abonnement</p>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS_OPTIONS.map((m) => {
              const disc = MONTH_DISCOUNTS[m];
              return (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className="rounded-xl py-3 px-2 text-center border transition-all"
                  style={{
                    background: months === m ? '#534AB718' : 'rgba(255,255,255,0.03)',
                    borderColor: months === m ? '#534AB7' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="text-white font-bold text-sm">{m} mois</div>
                  {disc > 0 && (
                    <div className="text-xs mt-0.5 font-semibold" style={{ color: '#10B981' }}>-{disc}%</div>
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
              <span>{plan.label} × {months} mois</span>
              <span>{baseAmount.toLocaleString('fr-FR')} XOF</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between" style={{ color: '#10B981' }}>
                <span>Réduction {months} mois (-{discount}%)</span>
                <span>-{discountAmount.toLocaleString('fr-FR')} XOF</span>
              </div>
            )}
            <div className="border-t border-white/8 pt-2 flex justify-between font-black text-white text-base">
              <span>Total</span>
              <span>{finalAmount.toLocaleString('fr-FR')} XOF</span>
            </div>
          </div>
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
          {loading ? 'Redirection vers CinetPay…' : `Payer ${finalAmount.toLocaleString('fr-FR')} XOF`}
        </button>

        <p className="text-center text-xs text-white/30 mt-4">
          Paiement sécurisé par CinetPay. Aucune donnée bancaire n'est stockée par Tracix.
        </p>
      </div>
    </div>
  );
}
