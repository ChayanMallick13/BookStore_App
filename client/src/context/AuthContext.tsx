import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refresh = async (): Promise<User | null> => {
    setLoading(true);
    setSessionError(null);
    try {
      const { data } = await api.get<User>('/auth/me');
      setUser(data);
      return data;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        setUser(null);
        setSessionError('Unable to verify your session. Check your connection and try again.');
        throw error;
      }

      try {
        await api.post('/auth/refresh');
        const { data } = await api.get<User>('/auth/me');
        setUser(data);
        return data;
      } catch (refreshError) {
        setUser(null);
        if (refreshError instanceof ApiError && refreshError.status === 401) return null;
        setSessionError('Unable to refresh your session. Please try again.');
        throw refreshError;
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const activeUser = await refresh();
      if (activeUser) await api.post('/auth/logout');
    }
    setUser(null);
    setSessionError(null);
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  return <AuthContext.Provider value={{ user, loading, sessionError, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
