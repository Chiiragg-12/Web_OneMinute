import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, request, setAccessToken, setSessionExpiredHandler } from '../api/client';

function response(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('typed API client', () => {
  afterEach(() => { vi.restoreAllMocks(); setAccessToken(null); setSessionExpiredHandler(undefined); window.history.pushState({}, '', '/'); });

  it('returns a successful login response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ accessToken: 'access', user: { id: 'u1', role: 'patient' } }));
    await expect(api.login({ email: 'patient@example.com', password: 'password123' })).resolves.toMatchObject({ accessToken: 'access' });
  });

  it('does not replace a Receptionist login failure with a stale refresh-token error', async () => {
    window.history.pushState({}, '', '/receptionist/login');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ error: 'Invalid email/phone or password' }, 401));
    await expect(api.login({ email: 'receptionist@example.com', password: 'wrong' })).rejects.toMatchObject({ status: 401, message: 'Invalid email/phone or password' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/login');
  });

  it('refreshes once and retries a request after a 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ error: 'expired' }, 401)).mockResolvedValueOnce(response({ accessToken: 'fresh' })).mockResolvedValueOnce(response({ patient: { healthId: 'H-1' } }));
    await expect(request('/api/patients/me')).resolves.toEqual({ patient: { healthId: 'H-1' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ credentials: 'include' });
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer fresh');
  });

  it('shares one refresh request across concurrent 401 responses', async () => {
    let resolveRefresh: (value: Response) => void = () => undefined;
    let protectedCalls = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/refresh/patient')) return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
      protectedCalls += 1;
      return Promise.resolve(protectedCalls <= 2 ? response({ error: 'expired' }, 401) : response({ patient: { healthId: 'H-1' } }));
    });
    const first = request('/api/patients/me');
    const second = request('/api/patients/me');
    await Promise.resolve();
    resolveRefresh(response({ accessToken: 'fresh' }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { patient: { healthId: 'H-1' } },
      { patient: { healthId: 'H-1' } },
    ]);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/api/auth/refresh/patient'))).toHaveLength(1);
  });

  it('keeps refresh work isolated per role while deduplicating same-role callers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(response({ accessToken: String(input).includes('/doctor') ? 'doctor-token' : 'patient-token' })));
    await Promise.all([api.refresh('patient'), api.refresh('patient'), api.refresh('doctor')]);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/api/auth/refresh/patient'))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/api/auth/refresh/doctor'))).toHaveLength(1);
  });

  it('notifies session expiry once when concurrent refresh fails', async () => {
    const onExpired = vi.fn(); setAccessToken('old'); setSessionExpiredHandler(onExpired);
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ error: 'expired' }, 401))
      .mockResolvedValueOnce(response({ error: 'refresh expired' }, 401))
      .mockResolvedValueOnce(response({ error: 'expired' }, 401));
    await expect(Promise.allSettled([request('/api/patients/me'), request('/api/appointments')])).resolves.toHaveLength(2);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/api/auth/refresh/patient'))).toHaveLength(1);
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('clears the token and stops retrying when refresh fails', async () => {
    const expired = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ error: 'expired' }, 401)).mockResolvedValueOnce(response({ error: 'refresh expired' }, 401));
    const onExpired = vi.fn(); setSessionExpiredHandler(onExpired); setAccessToken('old');
    await expect(request('/api/patients/me')).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledTimes(2);
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('logs out through the backend-managed refresh cookie', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(null, 204));
    await expect(api.logout()).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('uses role-isolated refresh and logout endpoints for Doctor routes', async () => {
    window.history.pushState({}, '', '/doctor/login');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ accessToken: 'fresh' }));
    await api.refresh(); await api.logout();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/refresh/doctor');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/logout/doctor');
  });
});
