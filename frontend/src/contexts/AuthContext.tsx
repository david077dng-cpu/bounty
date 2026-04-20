import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '../types';
import { authApi } from '../services/api';
import { soundManager } from '../utils/sound';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const res = await authApi.me();
        if (res.data.success && res.data.user) {
          setUser(res.data.user);
        }
      } catch (error) {
        // Not authenticated, clear user
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authApi.login(username, password);
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        soundManager.playSuccess();
        return { success: true };
      }
      soundManager.playError();
      return { success: false, error: res.data.error || 'Login failed' };
    } catch (error: any) {
      soundManager.playError();
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  const register = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authApi.register(username, password);
      if (res.data.success && res.data.user) {
        soundManager.playSuccess();
        return { success: true };
      }
      soundManager.playError();
      return { success: false, error: res.data.error || 'Registration failed' };
    } catch (error: any) {
      soundManager.playError();
      return { success: false, error: error.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore errors on logout
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
