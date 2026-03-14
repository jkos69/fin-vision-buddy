import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserSession {
  senha: string;
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
      if (!parsed.senha || !parsed.tipo) return null;
      return parsed as UserSession;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  });

  const login = useCallback(async (senha: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('access_passwords')
      .select('*')
      .eq('senha', senha.trim())
      .single();

    if (error || !data) return false;

    const userSession: UserSession = {
      senha: data.senha,
      tipo: data.tipo as UserSession['tipo'],
      diretoria: data.diretoria,
      area: data.area,
      responsavel: data.responsavel,
      nomeDisplay: data.nome_display,
    };

    setSession(userSession);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userSession));
    return true;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

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
