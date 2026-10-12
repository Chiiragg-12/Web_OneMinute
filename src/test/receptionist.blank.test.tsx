import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const mocks = vi.hoisted(() => ({
  api: { getReceptionistDashboard: vi.fn() },
  useAuth: vi.fn(),
  streamDoctorQueue: vi.fn(),
}));

vi.mock('../api/client', () => ({ api: mocks.api, streamDoctorQueue: mocks.streamDoctorQueue }));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

const receptionist = { id: 'receptionist-1', fullName: 'Demo Receptionist', clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic', isActive: true } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.streamDoctorQueue.mockReturnValue(new Promise(() => undefined));
  mocks.api.getReceptionistDashboard.mockResolvedValue({ dashboard: { clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic', timezone: 'Asia/Kolkata' }, doctors: [], counts: { queued: 0, completed: 0 }, appointments: [] } });
  mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'receptionist-1', role: 'receptionist' }, patient: null, doctor: null, receptionist }, logout: vi.fn() });
});

describe('Receptionist login blank-page regression', () => {
  it('routes an authenticated Receptionist from login to the Receptionist overview', async () => {
    render(<MemoryRouter initialEntries={['/receptionist/login']}><App /></MemoryRouter>);

    expect(await screen.findByText('Clinic day at a glance')).toBeInTheDocument();
    expect(screen.getByText('OneMinute Demo Clinic')).toBeInTheDocument();
  });
});
