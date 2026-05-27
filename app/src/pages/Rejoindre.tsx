import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, User, Eye, EyeOff, CheckCircle, X, ArrowRight } from 'lucide-react';
import { api, setToken } from '@/lib/api';

interface RejoindreProps {
  onLoginWithToken: (token: string) => Promise<boolean>;
}

export function Rejoindre({ onLoginWithToken }: RejoindreProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<{ organization_name: string; role: string; expires_at: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.invitations.preview(token)
      .then(setPreview)
      .catch((e) => setPreviewError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = mode === 'new'
        ? { full_name: form.full_name, email: form.email, password: form.password }
        : { email: form.email };

      const { token: jwt } = await api.invitations.accept(token, payload);
      setToken(jwt);
      await onLoginWithToken(jwt);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation.');
    } finally {
      setSubmitting(false);
    }
  };

  const ROLE_LABEL: Record<string, string> = {
    viewer: 'Lecteur — consultation uniquement',
    editor: 'Éditeur — lecture et modifications',
    admin: 'Administrateur',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#534AB7]/30 border-t-[#534AB7] rounded-full animate-spin" />
      </div>
    );
  }

  if (previewError) {
    return (
      <div className="min-h-screen bg-[#07070F] flex items-center justify-center p-4">
        <div className="max-w-sm w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Invitation invalide</h2>
          <p className="text-sm text-red-300/80 mb-6">{previewError}</p>
          <button onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)' }}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070F] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'linear-gradient(160deg, #0F0F1E, #0A0A16)' }}>
        <div className="absolute-ignored" />

        <div className="px-8 pt-8 pb-0 text-center">
          <img src="/favicon.png" alt="Tracix" className="w-10 h-10 object-contain mx-auto mb-3" />
          <h2 className="text-xl font-black text-white">Vous êtes invité !</h2>
          <p className="text-sm text-white/40 mt-1">Rejoindre une organisation sur Tracix</p>

          {/* Org card */}
          {preview && (
            <div className="mt-5 mb-6 p-4 rounded-xl border border-[#534AB7]/30 bg-[#534AB7]/10">
              <p className="text-[11px] text-white/40 mb-1">Organisation</p>
              <p className="text-base font-black text-white">{preview.organization_name}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-white/70">{ROLE_LABEL[preview.role] ?? preview.role}</span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button onClick={() => setMode('new')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'new' ? 'bg-[#534AB7] text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
              Créer un compte
            </button>
            <button onClick={() => setMode('existing')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'existing' ? 'bg-[#534AB7] text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
              J'ai déjà un compte
            </button>
          </div>
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'new' && (
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="text" value={form.full_name} onChange={set('full_name')} required autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
                    placeholder="Kofi Mensah" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input type="email" value={form.email} onChange={set('email')} required
                  autoFocus={mode === 'existing'}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
                  placeholder="vous@email.com" />
              </div>
            </div>

            {mode === 'new' && (
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5">Mot de passe <span className="font-normal text-white/25">(10 car. min, 1 majuscule, 1 chiffre)</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={10}
                    className="w-full pl-10 pr-10 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[#534AB7]/60 outline-none transition-colors"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'existing' && (
              <p className="text-xs text-white/30 leading-relaxed">
                Entrez l'email de votre compte Tracix existant. Vous serez ajouté à l'organisation sans avoir à ressaisir votre mot de passe.
              </p>
            )}

            <button type="submit" disabled={submitting}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7C3AED)', boxShadow: '0 0 30px rgba(83,74,183,0.25)' }}>
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Rejoindre…</>
                : <>Rejoindre l'organisation <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-white/20 mt-4 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            Connexion sécurisée
          </p>
        </div>
      </div>
    </div>
  );
}
