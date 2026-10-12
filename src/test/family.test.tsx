import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyMemberFormPage, FamilyMemberPage, FamilyMembersPage } from '../pages/FamilyPages';

const mocks = vi.hoisted(() => ({ api: { listFamilyMembers: vi.fn(), createFamilyMember: vi.fn(), getFamilyMember: vi.fn(), updateFamilyMember: vi.fn(), uploadHealthRecord: vi.fn(), openHealthRecord: vi.fn() } }));
vi.mock('../api/client', () => ({ api: mocks.api }));

const member = { id: 'member-1', fullName: 'Rajesh Sharma', relationship: 'Father', dob: '1960-01-02T00:00:00.000Z', heightCm: 179, weightKg: 70, sex: 'male', bmi: 21.8, records: [] };
function renderFamily(path = '/app/family') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/family" element={<FamilyMembersPage />} /><Route path="/app/family/new" element={<FamilyMemberFormPage />} /><Route path="/app/family/:familyMemberId" element={<FamilyMemberPage />} /><Route path="/app/family/:familyMemberId/edit" element={<FamilyMemberFormPage />} /></Routes></MemoryRouter>); }

beforeEach(() => { vi.clearAllMocks(); mocks.api.listFamilyMembers.mockResolvedValue({ familyMembers: [member] }); mocks.api.getFamilyMember.mockResolvedValue({ familyMember: member }); mocks.api.createFamilyMember.mockResolvedValue({ familyMember: member }); mocks.api.updateFamilyMember.mockResolvedValue({ familyMember: member }); mocks.api.uploadHealthRecord.mockResolvedValue({ record: { id: 'record-1', type: 'lab_report', title: 'Blood report', documentDate: null, originalFilename: 'report.pdf' } }); mocks.api.openHealthRecord.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })); });

describe('family member profiles and health records', () => {
  it('lists the owned family member and its health profile', async () => { renderFamily(); expect(await screen.findByText('Rajesh Sharma')).toBeInTheDocument(); expect(screen.getByText('179 cm')).toBeInTheDocument(); expect(screen.getByText('21.8')).toBeInTheDocument(); });
  it('creates a family member using the existing health profile fields', async () => { renderFamily('/app/family/new'); const user = userEvent.setup(); await user.type(screen.getByLabelText('Name'), 'Sunita Sharma'); await user.type(screen.getByLabelText('Relationship'), 'Mother'); await user.type(screen.getByLabelText('Height (cm)'), '165'); await user.type(screen.getByLabelText('Weight (kg)'), '60'); await user.click(screen.getByRole('button', { name: 'Create family member' })); await waitFor(() => expect(mocks.api.createFamilyMember).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Sunita Sharma', relationship: 'Mother', heightCm: 165, weightKg: 60 }))); });
  it('uploads a selected health record for the family member', async () => { renderFamily('/app/family/member-1'); await screen.findByText('Previous documents'); const user = userEvent.setup(); const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' }); await user.upload(screen.getByLabelText('Choose file'), file); await user.click(screen.getByRole('button', { name: 'Upload record' })); await waitFor(() => expect(mocks.api.uploadHealthRecord).toHaveBeenCalledWith(file, { type: 'old_prescription' }, 'member-1')); });
});
