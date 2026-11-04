import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanionOverview, CompanionPerson, CompanionBookingDetail, CompanionFinance } from '../features/companions/pages';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), remove: vi.fn(), download: vi.fn() }));
vi.mock('../features/companions/api', () => ({ companionAdmin: mocks }));
vi.mock('../api/client', () => ({ downloadPrivateFile: mocks.download, ApiError: class extends Error {} }));
const person = { id: 'c1', userId: 'u1', fullName: 'Asha Rao', phone: '9876543210', languages: ['Hindi'], serviceAreas: ['Central'], capabilities: [], suspended: false, verificationStatus: 'pending', verifiedUntil: null, availability: [] };
const booking = { id: 'b1', status: 'picked_up', amount: 50000, scheduledAt: '2030-01-01T10:00:00Z', companion: { ...person, verificationStatus: 'approved' }, payment: { status: 'paid' }, itinerary: { patient: { fullName: 'Senior Patient', assistanceNeeds: ['Walking assistance'] }, pickup: { address: 'Patient home' }, destination: { name: 'City Hospital', address: 'Hospital road' }, emergencyContacts: [] } };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.post.mockResolvedValue({}); });
function at(path: string, element: React.ReactNode) { render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/companions/people/:id" element={element} /><Route path="/admin/companions/bookings/:id" element={element} /><Route path="/admin/companions" element={element} /></Routes></MemoryRouter>); }
describe('Senior Companion administration', () => {
  it('shows actual service state and links to outstanding safety work', async () => {
    mocks.get.mockImplementation((path: string) => Promise.resolve(path === '/service' ? { enabled: false } : { bookingStates: [{ status: 'picked_up', _count: 2 }], verificationStates: [{ verificationStatus: 'pending', _count: 3 }], openIncidents: 1, openComplaints: 4, pendingRefunds: 2 }));
    at('/admin/companions', <CompanionOverview />);
    expect(await screen.findByText(/New bookings are currently disabled/)).toBeInTheDocument();
    expect(await screen.findByText('Active journeys')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open safety incidents/ })).toHaveAttribute('href', '/admin/companions/safety');
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
  });
  it('requires review acknowledgement and sends the verification decision with expiry and notes', async () => {
    mocks.get.mockResolvedValue({ companion: person, documents: [{ id: 'doc1', kind: 'identity', status: 'pending', createdAt: '2030-01-01T00:00:00Z' }] });
    at('/admin/companions/people/c1', <CompanionPerson />);
    await screen.findByText('Asha Rao');
    fireEvent.change(screen.getByLabelText(/Valid until/), { target: { value: '2030-12-01T12:00' } });
    fireEvent.change(screen.getByLabelText('Review notes'), { target: { value: 'Identity and background evidence reviewed' } });
    const button = screen.getByRole('button', { name: 'Save verification decision' });
    await userEvent.setup().click(button);
    expect(mocks.post).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByLabelText(/I reviewed the submitted identity/));
    await userEvent.setup().click(button);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/companions/c1/review', expect.objectContaining({ decision: 'approved', note: 'Identity and background evidence reviewed', expiresAt: expect.any(String) })));
  });
  it('does not show ordinary cancellation after pickup and exposes supervised handover', async () => {
    mocks.get.mockImplementation((path: string) => Promise.resolve(path.includes('/tracker') ? { trackingActive: true, locationStale: true, location: null } : path.includes('companions?') ? { items: [person] } : { booking, events: [] }));
    at('/admin/companions/bookings/b1', <CompanionBookingDetail />);
    expect(await screen.findByText('Senior Patient')).toBeInTheDocument();
    expect(screen.queryByText('Cancel before pickup')).not.toBeInTheDocument();
    expect(screen.getByText('Supervised safe handover')).toBeInTheDocument();
    expect(await screen.findByText(/Location is unavailable or more than two minutes old/)).toBeInTheDocument();
    expect(screen.getByLabelText('Family drop-off confirmation code')).toBeRequired();
  });
  it('requires review before processing a refund and never offers resubmission of an uncertain refund', async () => {
    mocks.get.mockImplementation((path: string) => Promise.resolve(path.includes('/refunds') ? { items: [{ id: 'r1', bookingId: 'b1', amount: 10000, status: 'pending', reason: 'Cancellation', createdAt: '2030-01-01T00:00:00Z' }, { id: 'r2', bookingId: 'b2', amount: 10000, status: 'processing', reason: 'Unknown outcome', createdAt: '2030-01-01T00:00:00Z' }] } : path.includes('reconciliation') ? { issues: [], checkedBookings: 0 } : { items: [] }));
    render(<MemoryRouter><CompanionFinance /></MemoryRouter>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refunds' }));
    const process = await screen.findByRole('button', { name: /Process .*refund/ });
    await userEvent.setup().click(process); expect(mocks.post).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByLabelText(/I reviewed the refund amount/));
    await userEvent.setup().click(process);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/refunds/r1/process'));
    expect(screen.getByRole('button', { name: 'Reconcile refund' })).toBeInTheDocument();
  });
});
