import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { safeReturnTo } from '../pages/AuthPages';

const mocks = vi.hoisted(() => ({
  api: { refresh: vi.fn(), login: vi.fn(), logout: vi.fn(), getReceptionistProfile: vi.fn(), getReceptionistDashboard: vi.fn(), listReceptionistAppointments: vi.fn(), getFinanceOverview: vi.fn() },
  setAccessToken: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
}));
vi.mock('../api/client', () => ({ ...mocks, ApiError: class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } } }));

const token = (role: string) => ['header', btoa(JSON.stringify({ sub: `${role}-user`, role })), 'signature'].join('.');
function renderApp(path: string) { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>); }

let sessionExpiredHandler: (() => void) | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  sessionExpiredHandler = undefined;
  mocks.setSessionExpiredHandler.mockImplementation((handler: (() => void) | undefined) => { sessionExpiredHandler = handler; });
  mocks.api.refresh.mockRejectedValue(new Error('expired'));
  mocks.api.login.mockRejectedValue(new Error('login unavailable'));
  mocks.api.logout.mockResolvedValue(null);
  mocks.api.getReceptionistProfile.mockResolvedValue({ receptionist: { id: 'r-1', fullName: 'Reception', clinic: null } });
});

describe('the website is for reception and admin', () => {
  it('opens on the sign-in page for reception and admin', async () => {
    renderApp('/');
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email or phone')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.queryByText('Use the OneMinute app')).toBeNull();
  });

  it.each(['/login', '/register', '/doctor', '/doctor/login', '/doctor/claim', '/app', '/app/appointments/abc'])('tells someone who opens the old patient or doctor address %s to use the app', async (path) => {
    renderApp(path);
    expect(await screen.findByText('Use the OneMinute app')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to the reception console' })).toHaveAttribute('href', '/receptionist/login');
  });

  it('keeps the privacy policy and terms public', async () => {
    renderApp('/privacy');
    expect(await screen.findByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('sends unknown addresses to the sign-in page', async () => {
    renderApp('/something/else');
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });
});

describe('role-scoped auth navigation', () => {
  it('sends a signed-out visitor from a reception page to the reception login, and from an admin page to the admin login', async () => {
    renderApp('/receptionist/appointments');
    expect((await screen.findAllByText('ONEMINUTE HEALTHCARE')).length).toBeGreaterThan(0);
    renderApp('/admin/payments');
    expect((await screen.findAllByText('ONEMINUTE HEALTHCARE')).length).toBeGreaterThan(0);
  });

  it('does not treat a reception session as an admin session', async () => {
    mocks.api.refresh.mockResolvedValue(token('receptionist'));
    renderApp('/admin');
    expect((await screen.findAllByText('ONEMINUTE HEALTHCARE')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Financial operations overview')).not.toBeInTheDocument();
  });

  it.each(['patient', 'doctor'])('does not keep a %s session on the website', async (role) => {
    mocks.api.refresh.mockResolvedValue(token(role));
    renderApp('/receptionist');
    expect((await screen.findAllByText('ONEMINUTE HEALTHCARE')).length).toBeGreaterThan(0);
    expect(mocks.api.getReceptionistProfile).not.toHaveBeenCalled();
  });

  it.each(['patient', 'doctor'])('refuses a %s account on the reception login and ends the session it opened', async (role) => {
    mocks.api.login.mockResolvedValue({ accessToken: token(role), user: { id: 'u1', role } });
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByText('Welcome back');
    await user.type(screen.getByLabelText('Email or phone'), 'someone@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Unable to sign in')).toBeInTheDocument();
    expect(screen.getByText(/This sign-in is for clinic reception and admin accounts/)).toBeInTheDocument();
    expect(mocks.api.logout).toHaveBeenCalledWith(role);
    expect(mocks.api.getReceptionistProfile).not.toHaveBeenCalled();
  });

  it.each(['Missing refresh token', 'Invalid or expired refresh token'])('never renders a bootstrap %s error on Receptionist login', async (message) => {
    mocks.api.refresh.mockRejectedValue(new Error(message));
    renderApp('/');
    expect((await screen.findAllByText('ONEMINUTE HEALTHCARE')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Your session has ended')).not.toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.api.logout).toHaveBeenCalled());
  });

  it('shows credential-specific feedback for a failed Receptionist login without refreshing', async () => {
    mocks.api.login.mockRejectedValue(new Error('Invalid email/phone or password'));
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByText('Welcome back');
    await user.type(screen.getByLabelText('Email or phone'), 'receptionist@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Unable to sign in')).toBeInTheDocument();
    expect(screen.getByText('Invalid email/phone or password')).toBeInTheDocument();
    expect(screen.queryByText('Your session has ended')).not.toBeInTheDocument();
  });

  it('shows only a user-friendly notice when an active Receptionist session expires', async () => {
    mocks.api.refresh.mockResolvedValue(token('receptionist'));
    renderApp('/receptionist');
    await waitFor(() => expect(sessionExpiredHandler).toBeTypeOf('function'));
    act(() => sessionExpiredHandler?.());
    expect((await screen.findAllByText('ONEMINUTE HEALTHCARE')).length).toBeGreaterThan(0);
    expect(screen.getByText('Your session has expired')).toBeInTheDocument();
    expect(screen.getByText('Please sign in again.')).toBeInTheDocument();
    expect(screen.queryByText('Invalid or expired refresh token')).not.toBeInTheDocument();
  });

  it('accepts only same-role internal return paths', () => {
    expect(safeReturnTo('/receptionist/appointments?view=payments&status=pending', 'receptionist')).toContain('status=pending');
    expect(safeReturnTo('https://attacker.test', 'receptionist')).toBe('/receptionist');
    expect(safeReturnTo('//attacker.test', 'receptionist')).toBe('/receptionist');
    expect(safeReturnTo('/admin/payments', 'receptionist')).toBe('/receptionist');
    expect(safeReturnTo('/receptionist/finance', 'admin')).toBe('/admin');
    expect(safeReturnTo('/admin/clinics', 'admin')).toBe('/admin/clinics');
    expect(safeReturnTo('/app/appointments', 'receptionist')).toBe('/receptionist');
  });
});
