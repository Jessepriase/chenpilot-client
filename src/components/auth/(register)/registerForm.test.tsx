import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import * as authStore from '@/store';
import { push } from 'next/navigation';
import { RegisterForm } from './registerForm';

vi.mock('@/store/slices/authSlice', () => ({
  register: vi.fn(),
  googleAuth: vi.fn(),
}));

vi.mock('@/store', () => {
  let error: string | null = null;
  return {
    useAppDispatch: vi.fn(() => vi.fn((action: unknown) => action)),
    useAppSelector: vi.fn((cb: (state: { auth: { error: string | null } }) => { error: string | null }) =>
      cb({ auth: { error } }),
    ),
    __setAuth: (s: { error?: string | null }) => {
      if (s.error !== undefined) error = s.error;
    },
  };
});

vi.mock('next/navigation', () => {
  const push = vi.fn();
  return { useRouter: vi.fn(() => ({ push })), push };
});

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { register } from '@/store/slices/authSlice';

const registerMock = vi.mocked(register);
const toastSuccess = vi.mocked(toast.success);
const setAuth = authStore.__setAuth;

const resolvable = () => {
  let resolve!: (value: { user: { id: string; email: string }; token: string }) => void;
  const p = new Promise<{ user: { id: string; email: string }; token: string }>((res) => {
    resolve = res;
  }) as Promise<{ user: { id: string; email: string }; token: string }> & {
    unwrap: () => Promise<{ user: { id: string; email: string }; token: string }>;
  };
  p.unwrap = () => p;
  return { promise: p, resolve: resolve! };
};

const renderForm = () => render(<RegisterForm />);
const submitButton = () => screen.getByRole('button', { name: /Create Account|Creating account/ });

const fillForm = () => {
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'Password1' } });
};

beforeEach(() => {
  setAuth({ error: null });
  registerMock.mockReset();
  push.mockClear();
});

test('renders with submit enabled, "Create Account" status and no inline server error', () => {
  renderForm();
  expect(submitButton()).not.toBeDisabled();
  expect(submitButton()).toHaveTextContent('Create Account');
  expect(screen.queryByText(/Email already in use|Server error/)).not.toBeInTheDocument();
});

test('disables submit and shows pending status while register is pending, then re-enables on success', async () => {
  const { promise, resolve } = resolvable();
  registerMock.mockReturnValue(promise);
  renderForm();
  fillForm();
  fireEvent.click(submitButton());

  await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
  expect(submitButton()).toBeDisabled();
  expect(submitButton()).toHaveTextContent('Creating account...');

  act(() => resolve({ user: { id: 'u1', email: 'a@b.com' }, token: 'tok' }));
  await waitFor(() => expect(submitButton()).not.toBeDisabled());
  expect(submitButton()).toHaveTextContent('Create Account');
  await waitFor(() => expect(push).toHaveBeenCalledWith('/chat'));
  expect(toastSuccess).toHaveBeenCalledWith('Account created successfully! Welcome to ChenPilot!');
});

test('shows server error inline after a rejected registration', () => {
  setAuth({ error: 'Email already in use' });
  renderForm();
  expect(submitButton()).not.toBeDisabled();
  expect(screen.getByText('Email already in use')).toBeInTheDocument();
});

test('clears inline error when a new registration attempt starts', () => {
  setAuth({ error: 'Email already in use' });
  setAuth({ error: null });
  renderForm();
  expect(screen.queryByText('Email already in use')).not.toBeInTheDocument();
});

test('retains input values after a failed submit attempt', () => {
  setAuth({ error: 'Email already in use' });
  renderForm();
  const email = screen.getByLabelText(/Email Address/i);
  const password = screen.getByLabelText(/Password/i);
  fireEvent.change(email, { target: { value: 'a@b.com' } });
  fireEvent.change(password, { target: { value: 'Password1' } });
  expect(email).toHaveValue('a@b.com');
  expect(password).toHaveValue('Password1');
  expect(screen.getByText('Email already in use')).toBeInTheDocument();
  expect(email).toHaveValue('a@b.com');
});
