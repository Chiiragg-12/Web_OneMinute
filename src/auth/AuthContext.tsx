import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { api, setAccessToken, setSessionExpiredHandler } from '../api/client';
import type { DoctorProfile, PatientProfile, ReceptionistProfile, UserSummary } from '../types/api';

type AuthState =
  | { status: 'loading'; accessToken: null; user: null; patient: null; doctor: null; receptionist: null }
  | { status: 'unauthenticated'; accessToken: null; user: null; patient: null; doctor: null; receptionist: null }
  | { status: 'authenticated'; accessToken: string; user: UserSummary; patient: PatientProfile | null; doctor: DoctorProfile | null; receptionist: ReceptionistProfile | null };

type AuthAction =
  | { type: 'authenticated'; accessToken: string; user: UserSummary; patient: PatientProfile | null; doctor: DoctorProfile | null; receptionist: ReceptionistProfile | null }
  | { type: 'signedOut' };

const initialState: AuthState = { status: 'loading', accessToken: null, user: null, patient: null, doctor: null, receptionist: null };

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  if (action.type === 'signedOut') return { status: 'unauthenticated', accessToken: null, user: null, patient: null, doctor: null, receptionist: null };
  return { status: 'authenticated', accessToken: action.accessToken, user: action.user, patient: action.patient, doctor: action.doctor, receptionist: action.receptionist };
}

interface AuthContextValue {
  state: AuthState;
  sessionExpired: boolean;
  login: (input: Record<string, unknown>) => Promise<UserSummary['role']>;
  register: (input: Record<string, unknown>, role?: UserSummary['role']) => Promise<void>;
  googleLogin: (credential: string, role: UserSummary['role']) => Promise<void>;
  claimDoctor: (input: Record<string, unknown>) => Promise<void>;
  completePasswordChange: (accessToken: string) => void;
  googleOnboardReceptionist: (input: Record<string, unknown>) => Promise<void>;
  logout: (role: UserSummary['role']) => Promise<void>;
  updatePatient: (input: Record<string, unknown>) => Promise<void>;
  updateDoctor: (doctor: DoctorProfile) => void;
  updateReceptionist: (receptionist: ReceptionistProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function authenticatedState(accessToken: string, user: UserSummary): Promise<Extract<AuthState, { status: 'authenticated' }>> {
  if (user.role === 'patient') {
    const { patient } = await api.getPatient();
    return { status: 'authenticated', accessToken, user, patient, doctor: null, receptionist: null };
  }
  if (user.role === 'doctor') {
    const { doctor } = await api.getDoctorProfile();
    return { status: 'authenticated', accessToken, user, patient: null, doctor, receptionist: null };
  }
  if (user.role === 'receptionist') {
    const { receptionist } = await api.getReceptionistProfile();
    return { status: 'authenticated', accessToken, user, patient: null, doctor: null, receptionist };
  }
  return { status: 'authenticated', accessToken, user, patient: null, doctor: null, receptionist: null };
}

function userFromAccessToken(token: string): UserSummary {
  const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string; role?: UserSummary['role']; mcp?: boolean };
  if (!payload.sub || !payload.role) throw new Error('Invalid authenticated session');
  return { id: payload.sub, role: payload.role, email: null, phone: null, mustChangePassword: payload.mcp === true };
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
        const next = await authenticatedState(token, userFromAccessToken(token));
        dispatch({ type: 'authenticated', accessToken: token, user: next.user, patient: next.patient, doctor: next.doctor, receptionist: next.receptionist });
      } catch {
        void api.logout().catch(() => undefined);
        signOut();
      }
    })();
    return () => setSessionExpiredHandler(undefined);
  }, []);

  const login = async (input: Record<string, unknown>) => {
    const result = await api.login(input); setAccessToken(result.accessToken);
    try { const next = await authenticatedState(result.accessToken, result.user); setSessionExpired(false); dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, patient: next.patient, doctor: next.doctor, receptionist: next.receptionist }); return next.user.role; }
    catch (error) { setAccessToken(null); throw error; }
  };

  const register = async (input: Record<string, unknown>, role: UserSummary['role'] = 'patient') => {
    const result = role === 'doctor' ? await api.registerDoctor(input) : role === 'receptionist' ? await api.registerReceptionist(input) : await api.registerPatient(input); setAccessToken(result.accessToken, role);
    try { const next = await authenticatedState(result.accessToken, result.user); dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, patient: next.patient, doctor: next.doctor, receptionist: next.receptionist }); }
    catch (error) { setAccessToken(null); throw error; }
  };

  const googleLogin = async (credential: string, role: UserSummary['role']) => {
    const result = await api.googleLogin(role, credential); setAccessToken(result.accessToken, role);
    const next = await authenticatedState(result.accessToken, result.user);
    dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, patient: next.patient, doctor: next.doctor, receptionist: next.receptionist });
  };

  const claimDoctor = async (input: Record<string, unknown>) => {
    const result = await api.claimDoctor(input); setAccessToken(result.accessToken, 'doctor');
    try { const next = await authenticatedState(result.accessToken, result.user); setSessionExpired(false); dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, patient: next.patient, doctor: next.doctor, receptionist: next.receptionist }); }
    catch (error) { setAccessToken(null); throw error; }
  };

  const completePasswordChange = (accessToken: string) => {
    if (state.status !== 'authenticated') return;
    setAccessToken(accessToken, state.user.role);
    dispatch({ type: 'authenticated', accessToken, user: { ...state.user, mustChangePassword: false }, patient: state.patient, doctor: state.doctor, receptionist: state.receptionist });
  };

  const googleOnboardReceptionist = async (input: Record<string, unknown>) => {
    const result = await api.googleOnboardReceptionist(input); setAccessToken(result.accessToken, 'receptionist');
    const next = await authenticatedState(result.accessToken, result.user);
    dispatch({ type: 'authenticated', accessToken: next.accessToken, user: next.user, patient: null, doctor: null, receptionist: next.receptionist });
  };

  const logout = async (role: UserSummary['role']) => { try { await api.logout(role); } finally { if (state.status !== 'authenticated' || state.user.role === role) signOut(); } };
  const updatePatient = async (input: Record<string, unknown>) => {
    const result = await api.updatePatient(input);
    if (state.status === 'authenticated' && state.user.role === 'patient') dispatch({ type: 'authenticated', accessToken: state.accessToken, user: state.user, patient: result.patient, doctor: null, receptionist: null });
  };
  const updateDoctor = (doctor: DoctorProfile) => {
    if (state.status === 'authenticated' && state.user.role === 'doctor') dispatch({ type: 'authenticated', accessToken: state.accessToken, user: state.user, patient: null, doctor, receptionist: null });
  };

  const updateReceptionist = (receptionist: ReceptionistProfile) => {
    if (state.status === 'authenticated' && state.user.role === 'receptionist') dispatch({ type: 'authenticated', accessToken: state.accessToken, user: state.user, patient: null, doctor: null, receptionist });
  };

  return <AuthContext.Provider value={{ state, sessionExpired, login, register, googleLogin, claimDoctor, completePasswordChange, googleOnboardReceptionist, logout, updatePatient, updateDoctor, updateReceptionist }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; }
