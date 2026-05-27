import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, X } from 'lucide-react';

interface OAuthCallbackProps {
  onLoginWithToken: (token: string) => Promise<boolean>;
}

export function OAuthCallback({ onLoginWithToken }: OAuthCallbackProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const err = params.get('error');

    if (err) {
      setError(decodeURIComponent(err));
      return;
    }

    if (!token) {
      setError('Token manquant dans le callback OAuth.');
      return;
    }

    // Refresh token is in the HttpOnly cookie set by the server — no need to read it from the URL
    onLoginWithToken(token).then((ok) => {
      if (ok) {
        window.location.href = '/dashboard';
      } else {
        setError('Connexion échouée — veuillez réessayer ou contacter le support.');
      }
    }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Erreur inattendue lors de la connexion OAuth.');
    });
  }, [onLoginWithToken, navigate]);

  return (
    <div className="min-h-screen bg-[#07070F] flex items-center justify-center p-4">
      {error ? (
        <div className="max-w-sm w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Erreur de connexion</h2>
          <p className="text-sm text-red-300/80 mb-6">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
          >
            Retour à l'accueil
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#534AB7]/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#818CF8]" />
          </div>
          <div className="w-8 h-8 border-2 border-[#534AB7]/30 border-t-[#534AB7] rounded-full animate-spin" />
          <p className="text-sm text-white/40">Connexion en cours…</p>
        </div>
      )}
    </div>
  );
}
