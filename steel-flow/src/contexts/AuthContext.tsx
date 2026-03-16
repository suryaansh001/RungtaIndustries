import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

export type UserRole = 'admin' | 'operator' | 'viewer';

interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem('ric_token');
      const storedUser = localStorage.getItem('ric_user');

      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch { /* ignore invalid local cache */ }
      }

      if (!token) return;

      try {
        const { data } = await api.get('/auth/me');
        const me = data?.data;
        if (me) {
          const normalizedUser: AuthUser = {
            id: me.id,
            username: me.username,
            role: me.role,
            email: me.email,
          };
          localStorage.setItem('ric_user', JSON.stringify(normalizedUser));
          localStorage.setItem('ric_role', normalizedUser.role);
          localStorage.setItem('ric_username', normalizedUser.username);
          setUser(normalizedUser);
        }
      } catch {
        // Let api interceptor handle refresh token flow and fallback logout.
      }
    };

    void bootstrapAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    const { accessToken, refreshToken, user: u } = data.data;
    localStorage.setItem('ric_token', accessToken);
    localStorage.setItem('ric_refresh', refreshToken);
    localStorage.setItem('ric_user', JSON.stringify(u));
    // Legacy keys for backward compat with any existing code
    localStorage.setItem('ric_role', u.role);
    localStorage.setItem('ric_username', u.username);
    setUser(u);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    ['ric_token', 'ric_refresh', 'ric_user', 'ric_role', 'ric_username'].forEach((k) => localStorage.removeItem(k));
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isOperator: user?.role === 'operator' || user?.role === 'admin',
      login,
      logout,
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
