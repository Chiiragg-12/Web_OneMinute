import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistLayout } from '../components/ReceptionistLayout';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

const receptionist = { id: 'r1', fullName: 'Reception A', clinic: { id: 'clinic-1', name: 'Demo Clinic', isActive: true } };
const routes = [
  ['/receptionist', 'Overview'],
  ['/receptionist/appointments', 'Appointments'],
  ['/receptionist/appointments?view=payments&status=pending', 'Payments'],
  ['/receptionist/appointments?view=consultations&status=completed', 'Consultations'],
  ['/receptionist/history?recipient=family', 'History'],
  ['/receptionist/walk-in', 'Walk-In'],
  ['/receptionist/queue', 'Queue'],
] as const;

function renderLayout(path: string) { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/receptionist" element={<ReceptionistLayout />}><Route path="*" element={<Outlet />} /></Route></Routes></MemoryRouter>); }
function activeLabels(selector: string) { return Array.from(document.querySelectorAll(`${selector} a.active`)).map((element) => element.textContent?.trim()); }

beforeEach(() => { mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'u1', role: 'receptionist' }, patient: null, doctor: null, receptionist }, logout: vi.fn() }); });
afterEach(cleanup);

describe('Receptionist navigation active state', () => {
  it.each(routes)('highlights only %s as active on desktop', (path, label) => { renderLayout(path); expect(activeLabels('aside')).toEqual([label]); expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(label); });
});