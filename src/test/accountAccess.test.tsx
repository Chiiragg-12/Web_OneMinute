import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorInviteCard } from '../components/DoctorInviteCard';
import { ReceptionistAddDoctorPage } from '../pages/ReceptionistAddDoctorPage';

const mocks = vi.hoisted(() => ({
  api: { listDoctorsAwaitingLogin: vi.fn(), reissueDoctorInvite: vi.fn(), listDoctorRequests: vi.fn(), createReceptionistDoctor: vi.fn() },
}));
vi.mock('../api/client', () => ({ api: mocks.api, ApiError: class ApiError extends Error { status = 0; } }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

// A doctor a receptionist adds takes the profile over in the mobile app with a one-time code.
describe('receptionist: giving a doctor their code', () => {
  it('shows the code and the Doctor ID with clear instructions, and copies a ready-to-send message', async () => {
    const user = userEvent.setup(); // installs its own clipboard stub, so spy on it afterwards
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DoctorInviteCard doctorName="Dr. Asha Rao" publicDoctorId="OMD-A1B2C3D4" code="K7M2-QX9P" expiresAt="2026-10-20T05:00:00.000Z" />);
    expect(screen.getByText('K7M2-QX9P')).toBeInTheDocument();
    expect(screen.getByText('OMD-A1B2C3D4')).toBeInTheDocument();
    expect(screen.getByText(/shown only now/)).toBeInTheDocument();
    expect(screen.getByText(/Activate your account/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copy message for the doctor/ }));
    const message = writeText.mock.calls[0][0];
    expect(message).toContain('Invite code: K7M2-QX9P');
    expect(message).toContain('Doctor ID: OMD-A1B2C3D4');
    expect(message).toContain('Install the OneMinute app');
    expect(message).toContain('/get-the-app');
    expect(message).not.toContain('/doctor/claim');
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
