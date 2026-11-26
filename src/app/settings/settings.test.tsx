import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import SettingsPage from './page';
import { push } from 'next/navigation';

vi.mock('@/components/layout/ChatLayout', () => ({
  ChatLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/store/slices/authSlice', () => ({
  fetchProfile: vi.fn(),
  clearAuth: vi.fn(),
}));

vi.mock('@/store', () => ({
  useAppDispatch: vi.fn(() => vi.fn((action: unknown) => action)),
  useAppSelector: vi.fn((cb: (state: { auth: { isAuthenticated: boolean; user: { name: string; email: string; address: string; authProvider: string }; isLoading: boolean }; ui: { theme: { mode: string } } }) => unknown) =>
    cb({
      auth: {
        isAuthenticated: true,
        user: { name: 'Alice', email: 'alice@example.com', address: 'G123', authProvider: 'email' },
        isLoading: false,
      },
      ui: { theme: { mode: 'dark' } },
    }),
  ),
}));

vi.mock('@/services/api', () => ({
  default: {
    deleteAccount: vi.fn(),
  },
}));

vi.mock('next/navigation', () => {
  const push = vi.fn();
  return { useRouter: vi.fn(() => ({ push })), push };
});
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import apiService from '@/services/api';
import { clearAuth } from '@/store/slices/authSlice';

const deleteAccountMock = vi.mocked(apiService.deleteAccount);
const clearAuthMock = vi.mocked(clearAuth);
const pushMock = vi.mocked(push);
const toastSuccess = vi.mocked(toast.success);

const renderPage = () => render(<SettingsPage />);

beforeEach(() => {
  deleteAccountMock.mockReset();
  clearAuthMock.mockReset();
  pushMock.mockClear();
  toastSuccess.mockClear();
});

test('delete account confirmation modal names the account and consequence', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));
  const dialog = screen.getByRole('dialog', { hidden: false });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText(/permanently delete your account/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/all associated data/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /Delete Account/i })).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
});

test('confirming account deletion calls deleteAccount, clears auth, and redirects', async () => {
  deleteAccountMock.mockResolvedValue({ success: true, data: { message: 'deleted' } });
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));
  const dialog = screen.getByRole('dialog', { hidden: false });
  fireEvent.click(within(dialog).getByRole('button', { name: /Delete Account/i }));
  await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(clearAuthMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/auth/login'));
  expect(toastSuccess).toHaveBeenCalledWith('Account deleted successfully.');
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});

test('canceling account deletion closes the modal without calling deleteAccount', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));
  const dialog = screen.getByRole('dialog', { hidden: false });
  fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/i }));
  expect(deleteAccountMock).not.toHaveBeenCalled();
  expect(clearAuthMock).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});

test('pressing Escape closes the delete account modal without calling deleteAccount (keyboard cancel)', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(deleteAccountMock).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});
