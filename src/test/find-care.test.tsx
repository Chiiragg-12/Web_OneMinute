import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicsPage } from '../pages/PatientPages';

const mocks = vi.hoisted(() => ({ api: { discoverCare: vi.fn() }, getCurrentDeviceLocation: vi.fn() }));
vi.mock('../api/client', () => ({ api: mocks.api }));
vi.mock('../utils/location', () => ({ getCurrentDeviceLocation: mocks.getCurrentDeviceLocation }));
const result = { doctor: { id: 'doctor-1', fullName: 'Dr. Card', specialization: 'Cardiologist' }, clinic: { id: 'clinic-1', name: 'Near Clinic', address: '1 Main Road', timezone: 'Asia/Kolkata' }, distanceKm: 2.4, options: [{ consultationMode: 'video', durationMinutes: 20, priceCents: 200000 }, { consultationMode: 'chat', durationMinutes: 10, priceCents: 50000 }] };
beforeEach(() => { vi.clearAllMocks(); mocks.api.discoverCare.mockResolvedValue({ results: [result], specialties: ['General Physician', 'Cardiologist', 'Dermatologist'] }); });

describe('Find Care', () => {
  it('requests location only after an explicit action and reloads discovery with coordinates', async () => {
    mocks.getCurrentDeviceLocation.mockResolvedValue({ latitude: 12.9716, longitude: 77.5946, accuracyMeters: 12, isApproximate: false });
    render(<MemoryRouter><ClinicsPage /></MemoryRouter>); const user = userEvent.setup();
    await screen.findByText('Dr. Card');
    expect(mocks.getCurrentDeviceLocation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Use Current Location' }));
    await waitFor(() => expect(mocks.api.discoverCare).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 12.9716, longitude: 77.5946 })));
    expect(screen.getByLabelText('Distance')).toBeEnabled();
  });
  it('sends combined specialty, mode, and price filters and renders clinic-specific care results', async () => {
    render(<MemoryRouter><ClinicsPage /></MemoryRouter>); const user = userEvent.setup();
    expect(await screen.findByText('Dr. Card')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('All Specialties'), 'Cardiologist');
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await user.selectOptions(screen.getByLabelText('Consultation Price'), '200000');
    await waitFor(() => expect(mocks.api.discoverCare).toHaveBeenLastCalledWith(expect.objectContaining({ specialty: 'Cardiologist', maxPrice: 200000, consultationModes: ['video'] })));
    expect(screen.getByText(/2.4 km away/)).toBeInTheDocument();
    expect(screen.getByText(/video from ₹2,000/)).toBeInTheDocument();
  });
  it('shows a recovery message when location permission is denied and keeps search usable', async () => {
    mocks.getCurrentDeviceLocation.mockRejectedValue(new Error('Location permission is denied. Enable it in Android Settings, then try again.'));
    render(<MemoryRouter><ClinicsPage /></MemoryRouter>); const user = userEvent.setup(); await screen.findByText('Dr. Card');
    await user.click(screen.getByRole('button', { name: 'Use Current Location' }));
    expect(await screen.findByText(/Enable it in Android Settings/)).toBeInTheDocument();
    expect(screen.getByLabelText('Distance')).toBeDisabled();
    await user.type(screen.getByPlaceholderText('All Specialties'), 'Cardiologist'); await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(mocks.api.discoverCare).toHaveBeenLastCalledWith(expect.objectContaining({ specialty: undefined, consultationModes: [] })));
  });
  it('reuses successful coordinates for filter changes and after Clear Filters without requesting location again', async () => {
    mocks.getCurrentDeviceLocation.mockResolvedValue({ latitude: 12.9716, longitude: 77.5946, accuracyMeters: 12, isApproximate: false });
    render(<MemoryRouter><ClinicsPage /></MemoryRouter>); const user = userEvent.setup(); await screen.findByText('Dr. Card');
    await user.click(screen.getByRole('button', { name: 'Use Current Location' }));
    await waitFor(() => expect(mocks.api.discoverCare).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 12.9716, longitude: 77.5946 })));
    await user.type(screen.getByPlaceholderText('All Specialties'), 'Cardiologist'); await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(mocks.api.discoverCare).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 12.9716, longitude: 77.5946 })));
    expect(mocks.getCurrentDeviceLocation).toHaveBeenCalledTimes(1);
  });
  it('shows loading while locating and identifies clinics without coordinates', async () => {
    let resolveLocation!: (location: { latitude: number; longitude: number; accuracyMeters: number; isApproximate: boolean }) => void;
    mocks.getCurrentDeviceLocation.mockReturnValue(new Promise((resolve) => { resolveLocation = resolve; }));
    mocks.api.discoverCare.mockResolvedValue({ results: [{ ...result, distanceKm: null }], specialties: [] });
    render(<MemoryRouter><ClinicsPage /></MemoryRouter>); const user = userEvent.setup(); await screen.findByText('Dr. Card');
    await user.click(screen.getByRole('button', { name: 'Use Current Location' }));
    expect(screen.getByRole('button', { name: 'Getting location...' })).toBeDisabled();
    resolveLocation({ latitude: 12.9716, longitude: 77.5946, accuracyMeters: 900, isApproximate: true });
    expect(await screen.findByText(/Using approximate location/)).toBeInTheDocument();
    expect(await screen.findByText(/Distance unavailable for this clinic/)).toBeInTheDocument();
  });
});