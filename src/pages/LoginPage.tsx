import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Lock, LogIn, AlertCircle, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha.trim()) return;
    setError('');
    setLoading(true);
    try {
      const ok = await login(senha);
      if (!ok) setError('Senha não reconhecida');
    } catch {
      setError('Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-secondary via-background to-background relative overflow-hidden">
      <svg className="absolute -bottom-32 -right-32 w-[600px] h-[600px] opacity-[0.06] dark:opacity-[0.1] text-primary pointer-events-none" viewBox="0 0 200 200" fill="currentColor" aria-hidden>
        <path d="M100 10 Q170 30 190 100 T100 190 Q30 170 10 100 T100 10 Z" />
      </svg>

      <button onClick={toggleTheme} className="absolute top-4 right-4 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors z-10">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="glass-card p-10 w-full max-w-sm space-y-6 relative z-10 rounded-3xl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold tracking-tight">
            <span className="text-secondary dark:text-foreground">DFL</span> <span className="text-primary">fin-vision</span>
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Controle Orçamentário 2026</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="senha" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Senha de acesso
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={e => { setSenha(e.target.value); setError(''); }}
              placeholder="Digite sua senha"
              autoFocus
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !senha.trim()}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-display font-semibold hover:brightness-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Verificando...</span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Entrar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
