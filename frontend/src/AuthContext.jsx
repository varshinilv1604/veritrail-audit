import { createContext, useContext, useState, useCallback } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

function loadSession() {
  try {
    const raw = localStorage.getItem('session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  // Authenticates only - does not touch session state. Kept separate from
  // applySession so callers (e.g. a branded splash transition) can delay
  // the session commit, which is what the router's `session ? ... :
  // <Login/>` guard reacts to, without it firing mid-transition.
  const login = useCallback(async (email, password) => {
    return api.login(email, password); // { token, user, firm }
  }, []);

  const applySession = useCallback(({ token, user, firm }) => {
    localStorage.setItem('token', token);
    const next = { user, firm };
    localStorage.setItem('session', JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('session');
    setSession(null);
  }, []);

  const updateProfileName = useCallback(async (name) => {
    const { user } = await api.updateProfile(name);
    setSession((prev) => {
      const next = { ...prev, user: { ...prev.user, ...user } };
      localStorage.setItem('session', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, applySession, logout, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
