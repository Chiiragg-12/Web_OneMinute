import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorInviteCard } from '../components/DoctorInviteCard';
import { DoctorClaimPage, ForcePasswordChangePage, LoginPage } from '../pages/AuthPages';
import { ReceptionistAddDoctorPage } from '../pages/ReceptionistAddDoctorPage';
import App from '../App';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  claimDoctor: vi.fn(),
  completePasswordChange: vi.fn(),
  logout: vi.fn(),
  api: { changePassword: vi.fn(), listDoctorsAwaitingLogin: vi.fn(), reissueDoctorInvite: vi.fn(), listDoctorRequests: vi.fn(), createReceptionistDoctor: vi.fn() },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../api/client', () => ({ api: mocks.api, ApiError: class ApiError extends Error { status = 0; } }));

const signedOut = { state: { status: 'unauthenticated', user: null }, sessionExpired: false, login: vi.fn(), claimDoctor: mocks.claimDoctor };
const flaggedPatient = { state: { status: 'authenticated', user: { id: 'u1', role: 'patient', mustChangePassword: true } }, completePasswordChange: mocks.completePasswordChange, logout: mocks.logout };

beforeEach(() => { vi.clearAllMocks(); mocks.useAuth.mockReturnValue(signedOut); });
afterEach(cleanup);

describe('forced password change', () => {
  it('asks for the clinic password and a new one, then lifts the restriction with the fresh token', async () => {
    mocks.useAuth.mockReturnValue(flaggedPatient);
    mocks.api.changePassword.mockResolvedValue({ accessToken: 'fresh-token' });
    render(<MemoryRouter><ForcePasswordChangePage /></MemoryRouter>);
    expect(screen.getByText('Choose your own password')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Current password/), 'Temp-pass-1');
    await user.type(screen.getByLabelText('New password'), 'My-own-pass-9');
    await user.type(screen.getByLabelText('Confirm new password'), 'My-own-pass-9');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(mocks.api.changePassword).toHaveBeenCalledWith({ currentPassword: 'Temp-pass-1', newPassword: 'My-own-pass-9', confirmPassword: 'My-own-pass-9' });
    await waitFor(() => expect(mocks.completePasswordChange).toHaveBeenCalledWith('fresh-token'));
  });

  it('shows the server\'s message when the current password is wrong and does not continue', async () => {
    mocks.useAuth.mockReturnValue(flaggedPatient);
    mocks.api.changePassword.mockRejectedValue(new Error('The current password is incorrect'));
    render(<MemoryRouter><ForcePasswordChangePage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Current password/), 'wrong');
    await user.type(screen.getByLabelText('New password'), 'My-own-pass-9');
    await user.type(screen.getByLabelText('Confirm new password'), 'My-own-pass-9');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText(/current password is incorrect/)).toBeInTheDocument();
    expect(mocks.completePasswordChange).not.toHaveBeenCalled();
  });

  it('lets the person sign out instead', async () => {
    mocks.useAuth.mockReturnValue(flaggedPatient);
    render(<MemoryRouter><ForcePasswordChangePage /></MemoryRouter>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mocks.logout).toHaveBeenCalledWith('patient');
  });
});

describe('route guards', () => {
  const as = (role: string, extra: object) => ({ state: { status: 'authenticated', user: { id: 'u1', role, mustChangePassword: true }, ...extra }, completePasswordChange: mocks.completePasswordChange, logout: mocks.logout });

  it.each([
    ['patient', '/app', { patient: { healthProfileComplete: true, fullName: 'P' }, doctor: null, receptionist: null }],
    ['doctor', '/doctor', { patient: null, doctor: { fullName: 'D', clinics: [] }, receptionist: null }],
    ['receptionist', '/receptionist', { patient: null, doctor: null, receptionist: { fullName: 'R', clinic: { name: 'C' } } }],
  ])('shows only the password screen to a %s whose password someone else chose', async (role, path, extra) => {
    mocks.useAuth.mockReturnValue(as(role, extra));
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByText('Choose your own password')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('lets a normal patient straight through to the app', async () => {
    mocks.useAuth.mockReturnValue({ ...as('patient', { patient: { healthProfileComplete: false, fullName: 'P' }, doctor: null, receptionist: null }), state: { status: 'authenticated', user: { id: 'u1', role: 'patient', mustChangePassword: false }, patient: { healthProfileComplete: false, fullName: 'P' }, doctor: null, receptionist: null } });
    render(<MemoryRouter initialEntries={['/app']}><App /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('Choose your own password')).not.toBeInTheDocument());
  });
});

describe('doctor activation with an invite code', () => {
  const renderClaim = () => render(<MemoryRouter initialEntries={['/doctor/claim']}><Routes><Route path="/doctor/claim" element={<DoctorClaimPage />} /><Route path="/doctor" element={<div>Doctor home</div>} /></Routes></MemoryRouter>);

  it('sends the Doctor ID, code and the doctor\'s own login details, then opens the doctor app', async () => {
    mocks.claimDoctor.mockResolvedValue(undefined);
    renderClaim();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Doctor ID'), 'omd-a1b2c3d4');
    await user.type(screen.getByLabelText(/^Invite code/), 'k7m2-qx9p');
    await user.type(screen.getByLabelText(/^Email/), 'doc@example.com');
    await user.type(screen.getByLabelText('Choose a password'), 'My-own-pass-9');
    await user.type(screen.getByLabelText('Confirm password'), 'My-own-pass-9');
    await user.click(screen.getByRole('button', { name: /Activate account/ }));
    expect(mocks.claimDoctor).toHaveBeenCalledWith({ publicDoctorId: 'OMD-A1B2C3D4', inviteCode: 'K7M2-QX9P', email: 'doc@example.com', phone: undefined, password: 'My-own-pass-9', confirmPassword: 'My-own-pass-9' });
    expect(await screen.findByText('Doctor home')).toBeInTheDocument();
  });

  it('needs an email or a phone before it can be submitted', async () => {
    renderClaim();
    expect(screen.getByRole('button', { name: /Activate account/ })).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText('Phone'), '9876543210');
    expect(screen.getByRole('button', { name: /Activate account/ })).toBeEnabled();
  });

  it('stays on the page and shows the message when the code is rejected', async () => {
    mocks.claimDoctor.mockRejectedValue(new Error('This invitation is invalid or has expired. Ask the clinic for a new code.'));
    renderClaim();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Doctor ID'), 'OMD-A1B2C3D4');
    await user.type(screen.getByLabelText(/^Invite code/), 'AAAA-AAAA');
    await user.type(screen.getByLabelText(/^Email/), 'doc@example.com');
    await user.type(screen.getByLabelText('Choose a password'), 'My-own-pass-9');
    await user.type(screen.getByLabelText('Confirm password'), 'My-own-pass-9');
    await user.click(screen.getByRole('button', { name: /Activate account/ }));
    expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
    expect(screen.queryByText('Doctor home')).not.toBeInTheDocument();
  });

  it('is reachable from the doctor login page only', () => {
    render(<MemoryRouter><LoginPage audience="doctor" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Activate your account' })).toHaveAttribute('href', '/doctor/claim');
    cleanup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Activate your account' })).not.toBeInTheDocument();
  });
});

describe('receptionist: giving a doctor their code', () => {
  it('shows the code and the Doctor ID with clear instructions, and copies a ready-to-send message', async () => {
    const user = userEvent.setup(); // installs its own clipboard stub, so spy on it afterwards
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DoctorInviteCard doctorName="Dr. Asha Rao" publicDoctorId="OMD-A1B2C3D4" code="K7M2-QX9P" expiresAt="2026-10-20T05:00:00.000Z" />);
    expect(screen.getByText('K7M2-QX9P')).toBeInTheDocument();
    expect(screen.getByText('OMD-A1B2C3D4')).toBeInTheDocument();
    expect(screen.getByText(/shown only now/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copy message for the doctor/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Invite code: K7M2-QX9P'));
    expect(writeText.mock.calls[0][0]).toContain('/doctor/claim');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('lists doctors without a login and issues a new code on request', async () => {
    mocks.api.listDoctorRequests.mockResolvedValue({ requests: [] });
    mocks.api.listDoctorsAwaitingLogin.mockResolvedValue({ doctors: [{ id: 'd1', publicDoctorId: 'OMD-A1B2C3D4', fullName: 'Dr. Asha Rao', invite: { status: 'expired', expiresAt: '2026-10-01T00:00:00.000Z' } }] });
    mocks.api.reissueDoctorInvite.mockResolvedValue({ invite: { code: 'NEW1-CODE', expiresAt: '2026-10-20T05:00:00.000Z' } });
    render(<MemoryRouter><ReceptionistAddDoctorPage /></MemoryRouter>);
    expect(await screen.findByText(/OMD-A1B2C3D4 · Invite expired/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'New invite code' }));
    expect(mocks.api.reissueDoctorInvite).toHaveBeenCalledWith('d1');
    expect(await screen.findByText('NEW1-CODE')).toBeInTheDocument();
  });

  it('shows nothing extra when every doctor already has a login', async () => {
    mocks.api.listDoctorRequests.mockResolvedValue({ requests: [] });
    mocks.api.listDoctorsAwaitingLogin.mockResolvedValue({ doctors: [] });
    render(<MemoryRouter><ReceptionistAddDoctorPage /></MemoryRouter>);
    await screen.findByText('Add Doctor');
    expect(screen.queryByLabelText('Doctors waiting to log in')).not.toBeInTheDocument();
  });
});
