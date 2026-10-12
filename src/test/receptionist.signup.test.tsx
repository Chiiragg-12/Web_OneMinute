import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRegisterPage } from '../pages/AuthPages';

const mocks = vi.hoisted(() => ({ api: {}, register: vi.fn(), googleLogin: vi.fn() }));
vi.mock('../api/client', () => ({ api: mocks.api, ApiError: class ApiError extends Error { readonly status = 400; } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ state: { status: 'unauthenticated' }, register: mocks.register, googleLogin: mocks.googleLogin }) }));

describe('Receptionist clinic onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.register.mockResolvedValue(undefined);
  });

  it('collects new clinic and handler details without an existing-clinic selector', async () => {
    render(<MemoryRouter><StaffRegisterPage role="receptionist" /></MemoryRouter>);
    const user = userEvent.setup();
    expect(screen.queryByLabelText('Clinic')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Clinic Name'), 'Sharma Clinic');
    await user.type(screen.getByLabelText('Clinic Address'), '123 ABC Road');
    await user.type(screen.getByLabelText('City'), 'Delhi');
    await user.type(screen.getByLabelText('Pincode'), '110001');
    await user.type(screen.getByLabelText(/Handler Name/), 'Rahul Sharma');
    await user.type(screen.getByLabelText('Email Address'), 'rahul@example.com');
    await user.type(screen.getByLabelText('Phone Number'), '9876543210');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith({ clinicName: 'Sharma Clinic', clinicAddress: '123 ABC Road', city: 'Delhi', pincode: '110001', handlerName: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876543210', password: 'password123', confirmPassword: 'password123' }, 'receptionist'));
  });
});