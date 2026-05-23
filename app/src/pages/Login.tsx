// ═══════════════════════════════════════════
// Page Login
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Shield, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('demo@tracix.io');
  const [password, setPassword] = useState('tracix2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'magic'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('Email ou mot de passe incorrect');
      }
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const success = await onLogin('demo@tracix.io', 'tracix2026');
      if (!success) {
        setError('Impossible de se connecter avec le compte démo');
      }
    } catch {
      setError('Impossible de se connecter avec le compte démo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#534AB7]/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tracix</h1>
          <p className="text-sm text-gray-500 mt-1">Visibilité totale. Zéro angle mort.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'magic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Lien magique
            </button>
          </div>

          {/* Error toast */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none transition-colors"
                    placeholder="vous@entreprise.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Connexion...' : 'Se connecter'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleDemo}
                disabled={isSubmitting}
                className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Essayer sans compte
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none transition-colors"
                    placeholder="vous@entreprise.com"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Un lien de connexion sécurisé sera envoyé à cette adresse.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#534AB7] text-white rounded-lg text-sm font-medium hover:bg-[#3C3489] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Envoi...' : 'Envoyer le lien'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Connexion sécurisée — données chiffrées en transit et au repos
        </p>
      </div>
    </div>
  );
}
