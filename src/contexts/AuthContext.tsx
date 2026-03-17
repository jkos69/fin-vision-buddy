import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserSession {
  sessionToken: string;
  tipo: 'ceo' | 'diretoria' | 'area';
  diretoria: string | null;
  area: string | null;
  responsavel: string | null;
  nomeDisplay: string;
}

interface AuthContextType {
  session: UserSession | null;
  login: (senha: string) => Promise<boolean>;
  logout: () => void;
  isCEO: boolean;
  isDiretoria: boolean;
  isArea: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'opex-session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!parsed.sessionToken || !parsed.tipo) return null;
      return parsed as UserSession;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  });

  const login = useCallback(async (senha: string): Promise<boolean> => {
    const { data, error } = await supabase
      .rpc('create_session', { input_senha: senha.trim() });

    if (error || !data || data.length === 0) return false;

    const row = data[0];
    const userSession: UserSession = {
      sessionToken: row.session_token,
      tipo: row.tipo as UserSession['tipo'],
      diretoria: row.diretoria,
      area: row.area,
      responsavel: row.responsavel,
      nomeDisplay: row.nome_display,
    };

    setSession(userSession);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userSession));
    return true;
  }, []);

  const logout = useCallback(async () => {
    if (session?.sessionToken) {
      try { await supabase.rpc('destroy_session', { p_session_token: session.sessionToken }); } catch {}
    }
    setSession(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, [session]);

  // Session expiry check every 5 minutes
  useEffect(() => {
    if (!session?.sessionToken) return;

    const check = async () => {
      const { data } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('session_token', session.sessionToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!data) {
        setSession(null);
        sessionStorage.removeItem(SESSION_KEY);
      }
    };

    const interval = setInterval(check, 5 * 60 * 1000);
    check(); // Check immediately on mount
    return () => clearInterval(interval);
  }, [session?.sessionToken]);

  return (
    <AuthContext.Provider value={{
      session,
      login,
      logout,
      isCEO: session?.tipo === 'ceo',
      isDiretoria: session?.tipo === 'diretoria',
      isArea: session?.tipo === 'area',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
