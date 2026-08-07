import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as storage from '../lib/storage';
import { getApiBaseUrl } from '../config';
import { AuthUser } from '../types';

// Storage key for persisting the logged-in user across restarts
const SESSION_KEY = 'skynet_session_user';

interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore persisted session on startup
  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItemAsync(SESSION_KEY);
        if (stored) setUser(JSON.parse(stored));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // Call the same /api/auth/login endpoint the web app uses.
      // This avoids exposing the service role key in the mobile bundle and
      // reuses the existing SHA-256 + custom users table auth logic.
      const baseUrl = await getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let data: LoginResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned an invalid response (status ${res.status}).`);
      }

      if (data.success && data.user) {
        setUser(data.user);
        await storage.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
        return { ok: true };
      }

      return { ok: false, error: data.error || 'Invalid email or password.' };
    } catch (e: any) {
      return {
        ok: false,
        error: e.message || 'Could not reach the server. Check your API URL in Settings.',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await storage.deleteItemAsync(SESSION_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
