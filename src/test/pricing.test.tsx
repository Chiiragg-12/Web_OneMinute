import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorLayout } from '../components/DoctorLayout';
import { DoctorPricingPage } from '../pages/DoctorPages';
import { DoctorPage } from '../pages/PatientPages';

const mocks = vi.hoisted(() => ({ api: { getDoctorPricing: vi.fn(), updateDoctorPricing: vi.fn(), getDoctor: vi.fn(), getDoctorOptions: vi.fn() }, useAuth: vi.fn(), streamDoctorQueue: vi.fn() }));
vi.mock('../api/client', () => ({ api: mocks.api, streamDoctorQueue: mocks.streamDoctorQueue, ApiError: class ApiError extends Error { status = 400; } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

const doctor = { id: 'doctor-1', fullName: 'Dr. Demo', specialization: 'General medicine', clinics: [{ id: 'clinic-1', name: 'Demo Clinic', isActive: true }] };
const pricing = [{ id: 'p1', consultationMode: 'in_person', durationMinutes: 60, priceCents: 1500 }, { id: 'p2', consultationMode: 'video', durationMinutes: 20, priceCents: 2500 }];

beforeEach(() => { vi.clearAllMocks(); mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'u1', role: 'doctor' }, patient: null, doctor }, logout: vi.fn() }); mocks.api.getDoctorPricing.mockResolvedValue({ pricing }); mocks.api.updateDoctorPricing.mockImplementation(async (input: { consultationMode: string; priceCents: number }) => ({ pricing: { ...pricing.find((item) => item.consultationMode === input.consultationMode)!, priceCents: input.priceCents } })); mocks.api.getDoctor.mockResolvedValue({ doctor: { ...doctor, clinics: [{ id: 'clinic-1', name: 'Demo Clinic', timezone: 'Asia/Kolkata' }] } }); mocks.api.getDoctorOptions.mockResolvedValue({ doctor, clinicId: 'clinic-1', options: [{ consultationMode: 'video', durationMinutes: 20, priceCents: 2000 }] }); });

function renderDoctorPricing() { return render(<MemoryRouter initialEntries={['/doctor/pricing']}><Routes><Route path="/doctor" element={<DoctorLayout />}><Route path="pricing" element={<DoctorPricingPage />} /></Route></Routes></MemoryRouter>); }

describe('pricing money-unit boundary', () => {
  it('renders backend cents as matching rupee display and input values', async () => { renderDoctorPricing(); expect(await screen.findByText('₹15')).toBeInTheDocument(); expect(screen.getByLabelText('in_person 60 price in rupees')).toHaveValue(15); expect(screen.getByLabelText('video 20 price in rupees')).toHaveValue(25); });
  it('keeps edits local until Save Changes, then converts rupees to cents', async () => { renderDoctorPricing(); const input = await screen.findByLabelText('in_person 60 price in rupees'); const user = userEvent.setup(); expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled(); await user.clear(input); await user.type(input, '20'); await user.tab(); expect(mocks.api.updateDoctorPricing).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled(); await user.click(screen.getByRole('button', { name: 'Save Changes' })); await waitFor(() => expect(mocks.api.updateDoctorPricing).toHaveBeenCalledWith({ clinicId: 'clinic-1', consultationMode: 'in_person', durationMinutes: 60, priceCents: 2000 })); expect(await screen.findByText('Pricing updated.')).toBeInTheDocument(); });
  it('keeps unsaved values on failed save and does not show success', async () => { mocks.api.updateDoctorPricing.mockRejectedValue(new Error('Pricing unavailable')); renderDoctorPricing(); const input = await screen.findByLabelText('in_person 60 price in rupees'); const user = userEvent.setup(); await user.clear(input); await user.type(input, '20'); await user.click(screen.getByRole('button', { name: 'Save Changes' })); expect(await screen.findByText('Pricing unavailable')).toBeInTheDocument(); expect(screen.queryByText('Pricing updated.')).not.toBeInTheDocument(); expect(input).toHaveValue(20); });
  it('keeps patient-facing backend price display in rupees', async () => { render(<MemoryRouter initialEntries={['/app/clinics/clinic-1/doctors/doctor-1']}><Routes><Route path="/app/clinics/:clinicId/doctors/:doctorId" element={<DoctorPage />} /></Routes></MemoryRouter>); expect(await screen.findByText('₹20')).toBeInTheDocument(); expect(screen.queryByText('₹0.20')).not.toBeInTheDocument(); });
});
