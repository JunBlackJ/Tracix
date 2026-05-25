import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success' | 'invalid'>('form');

  useEffect(() => {
    if (!token) setStep('invalid');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return;
    if (password !== confirm) return;
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setStep('success');
    } catch {
      setStep('invalid');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0E0C1E] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="w-7 h-7 text-[#534AB7]" />
            <span className="text-2xl font-bold text-white">Tracix</span>
          </div>
          <p className="text-sm text-white/40">Réinitialisation du mot de passe</p>
        </div>

        {step === 'success' && (
          <div className="bg-white/5 border border-green-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-white font-semibold">Mot de passe modifié !</p>
            <p className="text-sm text-white/50">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
            >
              Aller à la connexion
            </button>
          </div>
        )}

        {step === 'invalid' && (
          <div className="bg-white/5 border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-white font-semibold">Lien invalide ou expiré</p>
            <p className="text-sm text-white/50">Ce lien de réinitialisation est invalide ou a expiré (validité 30 min).</p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-[#8B82D4] hover:text-white transition-colors"
            >
              ← Retour à la connexion
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-white/60">Nouveau mot de passe</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} autoFocus
                  autoComplete="new-password"
                  style={{ background: '#1A1730' }}
                  className="w-full pl-10 pr-10 border border-white/15 rounded-xl py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7]"
                  placeholder="Au moins 8 caractères"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="text-[11px] text-amber-400 mt-1">Au moins 8 caractères requis</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required autoComplete="new-password"
                style={{ background: '#1A1730' }}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#534AB7] ${confirm && confirm !== password ? 'border-red-500/50' : 'border-white/15'}`}
                placeholder="••••••••"
              />
              {confirm && confirm !== password && (
                <p className="text-[11px] text-red-400 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirm}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Modification…</> : 'Définir le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
