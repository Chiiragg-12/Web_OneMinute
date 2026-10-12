import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { api, setAccessToken, setSessionExpiredHandler } from '../api/client';
import type { ReceptionistProfile, UserSummary } from '../types/api';

// The website is for clinic reception teams and administrators only. Patients and doctors use the mobile app.
export type WebRole = 'receptionist' | 'admin';
const isWebRole = (role: UserSummary['role']): role is WebRole => role === 'receptionist' || role === 'admin';

type AuthState =
  | { status: 'loading'; accessToken: null; user: null; receptionist: null }
  | { status: 'unauthenticated'; accessToken: null; user: null; receptionist: null }
  | { status: 'authenticated'; accessToken: string; user: UserSummary; receptionist: ReceptionistProfile | null };

type AuthAction =
  | { type: 'authenticated'; accessToken: string; user: UserSummary; receptionist: ReceptionistProfile | null }
  | { type: 'signedOut' };

const initialState: AuthState = { status: 'loading', accessToken: null, user: null, receptionist: null };

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  if (action.type === 'signedOut') return { status: 'unauthenticated', accessToken: null, user: null, receptionist: null };
  return { status: 'authenticated', accessToken: action.accessToken, user: action.user, receptionist: action.receptionist };
}

interface AuthContextValue {
  state: AuthState;
  sessionExpired: boolean;
  /** Resolves with the account's role. A patient or doctor account is not signed in here; the caller ends that session. */
  login: (input: Record<string, unknown>) => Promise<UserSummary['role']>;
  register: (input: Record<string, unknown>, role?: 'receptionist') => Promise<void>;
  googleLogin: (credential: string, role: 'receptionist') => Promise<void>;
  googleOnboardReceptionist: (input: Record<string, unknown>) => Promise<void>;
  logout: (role: UserSummary['role']) => Promise<void>;
  updateReceptionist: (receptionist: ReceptionistProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function authenticatedState(accessToken: string, user: UserSummary): Promise<Extract<AuthState, { status: 'authenticated' }>> {
  if (user.role === 'receptionist') {
    const { receptionist } = await api.getReceptionistProfile();
    return { status: 'authenticated', accessToken, user, receptionist };
  }
  return { status: 'authenticated', accessToken, user, receptionist: null };
}

function userFromAccessToken(token: string): UserSummary {
  const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string; role?: UserSummary['role'] };
  if (!payload.sub || !payload.role) throw new Error('Invalid authenticated session');
  return { id: payload.sub, role: payload.role, email: null, phone: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [sessionExpired, setSessionExpired] = useState(false);
  const signOut = (expired = false) => { setAccessToken(null); setSessionExpired(expired); dispatch({ type: 'signedOut' }); };

  useEffect(() => {
    setSessionExpiredHandler(() => signOut(true));
    void (async () => {
      try {
        const token = await api.refresh();
        const user = userFromAccessToken(token);
        if (!isWebRole(user.role)) throw new Error('Not a website account');
        const next = await authenticatedState(token, user);
        dispatch({ type: 'authenticated', accessToken: token, user: next.user, receptionist: next.receptionist });
      } catch {
        void api.logout().catch(() => undefined);
        signOut();
      }
    })();
    return () => setSessionExpiredHandler(undefined);
  }, []);

  const login = async (input: Record<string, unknown>) => {
    const result = await api.login(input);
    if (!isWebRole(result.user.role)) return result.user.role;
    setAccessToken(result.accessToken);
    try {
      const next = await authenticatedState(result.accessToken, result.user);
      setSessionExpired(false);
      dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, receptionist: next.receptionist });
      return next.user.role;
    } catch (error) { setAccessToken(null); throw error; }
  };

  const register = async (input: Record<string, unknown>) => {
    const result = await api.registerReceptionist(input); setAccessToken(result.accessToken, 'receptionist');
    try { const next = await authenticatedState(result.accessToken, result.user); dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, receptionist: next.receptionist }); }
    catch (error) { setAccessToken(null); throw error; }
  };

  const googleLogin = async (credential: string, role: 'receptionist') => {
    const result = await api.googleLogin(role, credential); setAccessToken(result.accessToken, role);
    const next = await authenticatedState(result.accessToken, result.user);
    dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, receptionist: next.receptionist });
  };

  const googleOnboardReceptionist = async (input: Record<string, unknown>) => {
    const result = await api.googleOnboardReceptionist(input); setAccessToken(result.accessToken, 'receptionist');
    const next = await authenticatedState(result.accessToken, result.user);
    dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, receptionist: next.receptionist });
  };

  const logout = async (role: UserSummary['role']) => { try { await api.logout(role); } finally { if (state.status !== 'authenticated' || state.user.role === role) signOut(); } };

  const updateReceptionist = (receptionist: ReceptionistProfile) => {
    if (state.status === 'authenticated' && state.user.role === 'receptionist') dispatch({ type: 'authenticated', accessToken: state.accessToken, user: state.user, receptionist });
  };

  return <AuthContext.Provider value={{ state, sessionExpired, login, register, googleLogin, googleOnboardReceptionist, logout, updateReceptionist }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; }
