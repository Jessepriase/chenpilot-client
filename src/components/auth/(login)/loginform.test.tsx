import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import * as authStore from '@/store';
import { push } from 'next/navigation';
import LoginForm from './loginform';

vi.mock('@/store/slices/authSlice', () => ({
  login: vi.fn(),
  googleAuth: vi.fn(),
}));

vi.mock('@/store', () => {
  let isLoading = false;
  let error: string | null = null;
  return {
    useAppDispatch: vi.fn(() => vi.fn((action: unknown) => action)),
    useAppSelector: vi.fn((cb: (state: { auth: { isLoading: boolean; error: string | null } }) => { isLoading: boolean; error: string | null }) =>
      cb({ auth: { isLoading, error } }),
    ),
    __setAuth: (s: { isLoading?: boolean; error?: string | null }) => {
      if (s.isLoading !== undefined) isLoading = s.isLoading;
      if (s.error !== undefined) error = s.error;
    },
  };
});

vi.mock('next/navigation', () => {
  const push = vi.fn();
  return { useRouter: vi.fn(() => ({ push })), push };
});

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { login } from '@/store/slices/authSlice';

const loginMock = vi.mocked(login);
const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);
const setAuth = authStore.__setAuth;

const resolvable = () => {
  let resolve!: () => void;
  const p = new Promise<void>((res) => {
    resolve = res;
  }) as Promise<void> & { unwrap: () => Promise<void> };
  p.unwrap = () => p;
  return { promise: p as unknown as Promise<{ user: { id: string }; token: string }>, resolve: resolve! };
};

const renderForm = () => render(<LoginForm />);
const submitButton = () => screen.getByRole('button', { name: /Sign In|Signing in/ });

beforeEach(() => {
  setAuth({ isLoading: false, error: null });
  loginMock.mockReset();
  push.mockClear();
});

test('renders with submit enabled, "Sign In" status and no inline server error', () => {
  renderForm();
  expect(submitButton()).not.toBeDisabled();
  expect(submitButton()).toHaveTextContent('Sign In');
  expect(screen.queryByText(/Invalid credentials|Server error/)).not.toBeInTheDocument();
});

test('disables submit and shows pending status while login is pending', () => {
  setAuth({ isLoading: true, error: null });
  renderForm();
  expect(submitButton()).toBeDisabled();
  expect(submitButton()).toHaveTextContent('Signing in...');
});

test('shows server error inline after a rejected login', () => {
  setAuth({ isLoading: false, error: 'Invalid credentials' });
  renderForm();
  expect(submitButton()).not.toBeDisabled();
  expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
});

test('clears inline error when a new login attempt starts', () => {
  setAuth({ isLoading: false, error: 'Invalid credentials' });
  setAuth({ isLoading: true, error: null });
  renderForm();
  expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  expect(submitButton()).toBeDisabled();
});

test('navigates and shows success toast on successful submit', async () => {
  const { promise, resolve } = resolvable();
  loginMock.mockReturnValue(promise);
  renderForm();
  fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
  fireEvent.click(submitButton());
  await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  act(() => resolve());
  await waitFor(() => expect(push).toHaveBeenCalledWith('/chat'));
  expect(toastSuccess).toHaveBeenCalledWith('Successfully logged in!');
});

test('shows error toast when submit fails', async () => {
  let reject!: (err: unknown) => void;
  const p = new Promise<void>((_res, rej) => {
    reject = rej;
  }) as Promise<void> & { unwrap: () => Promise<void> };
  p.unwrap = () => p;
  loginMock.mockReturnValue(p as unknown as Promise<{ user: { id: string }; token: string }>);
  renderForm();
  fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
  fireEvent.click(submitButton());
  await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  reject(new Error('Server error'));
  await waitFor(() => expect(toastError).toHaveBeenCalled());
});

test('retains input values after a failed submit attempt', () => {
  setAuth({ isLoading: false, error: 'Invalid credentials' });
  renderForm();
  const email = screen.getByLabelText(/Email Address/i);
  fireEvent.change(email, { target: { value: 'a@b.com' } });
  expect(email).toHaveValue('a@b.com');
  expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  expect(email).toHaveValue('a@b.com');
});
