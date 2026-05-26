import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

export function PaiementSucces() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const txnId = params.get('txn') ?? '';
  const provider = params.get('provider') ?? 'cinetpay';

  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'failed'>('loading');
  const [plan, setPlan] = useState('');
  const [months, setMonths] = useState(0);

  useEffect(() => {
    if (!txnId) { setStatus('failed'); return; }

    let attempts = 0;
    const poll = async () => {
      try {
        const data = provider === 'fedapay'
          ? await api.fedapay.status(txnId)
          : await api.payments.status(txnId);
        if (data.status === 'paid') {
          setStatus('paid');
          setPlan(data.plan);
          setMonths(data.months);
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setStatus('failed');
        } else if (attempts < 10) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setStatus('pending');
        }
      } catch {
        setStatus('failed');
      }
    };
    poll();
  }, [txnId, provider]);

  return (
    <div className="min-h-screen bg-[#0F0E1A] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-3xl border border-white/8 bg-white/3 p-10 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-violet-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Vérification du paiement…</h2>
            <p className="text-white/40 text-sm">Merci de patienter quelques secondes.</p>
          </>
        )}

        {status === 'paid' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Paiement confirmé !</h2>
            <p className="text-white/50 text-sm mb-6">
              Votre plan <span className="text-white font-semibold capitalize">{plan}</span> est actif pour {months} mois.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
            >
              Accéder à Tracix
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Paiement en cours de traitement</h2>
            <p className="text-white/50 text-sm mb-6">
              La confirmation peut prendre quelques minutes. Votre plan sera activé automatiquement.
            </p>
            <button onClick={() => navigate('/')} className="text-sm text-white/40 hover:text-white transition-colors">
              Retour à l'accueil
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Paiement non abouti</h2>
            <p className="text-white/50 text-sm mb-6">
              Le paiement a été annulé ou a échoué. Aucun montant n'a été débité.
            </p>
            <button
              onClick={() => navigate('/paiement')}
              className="w-full py-3 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
            >
              Réessayer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
