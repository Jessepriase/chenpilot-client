import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import toast from 'react-hot-toast';
import ContactsPage from './page';
import { Contact } from '@/types';

vi.mock('@/components/layout/ChatLayout', () => ({
  ChatLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/store/slices/contactsSlice', () => ({
  getContacts: vi.fn(),
  deleteContact: vi.fn(),
}));

vi.mock('@/store', () => {
  let contacts: Contact[] = [];
  let isLoading = false;
  return {
    useAppDispatch: vi.fn(() => vi.fn(() => {
      const p = Promise.resolve();
      (p as { unwrap: () => Promise<void> }).unwrap = () => p;
      return p;
    })),
    useAppSelector: vi.fn((cb: (state: { contacts: { list: Contact[]; isLoading: boolean }; auth: { isAuthenticated: boolean } }) => unknown) =>
      cb({ contacts: { list: contacts, isLoading }, auth: { isAuthenticated: true } }),
    ),
    __setContacts: (c: Contact[]) => {
      contacts = c;
    },
    __setLoading: (l: boolean) => {
      isLoading = l;
    },
  };
});

vi.mock('next/navigation', () => {
  const push = vi.fn();
  return { useRouter: vi.fn(() => ({ push })), push };
});
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { deleteContact } from '@/store/slices/contactsSlice';
import * as contactsStore from '@/store';

const deleteContactMock = vi.mocked(deleteContact);
const toastSuccess = vi.mocked(toast.success);
const setContacts = contactsStore.__setContacts;

const renderPage = () => render(<ContactsPage />);
const contact: Contact = { id: 'c1', name: 'Alice', address: 'G123', tokenType: 'STRK', createdAt: new Date().toISOString() };

beforeEach(() => {
  setContacts([contact]);
  deleteContactMock.mockReset();
  toastSuccess.mockClear();
});

test('delete confirmation modal names the contact and consequence', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  const dialog = screen.getByRole('dialog', { hidden: false });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText(/Alice/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/permanently remove/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
});

test('confirming deletion dispatches deleteContact and shows success', async () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  const dialog = screen.getByRole('dialog', { hidden: false });
  fireEvent.click(within(dialog).getByRole('button', { name: /Delete/i }));
  await waitFor(() => expect(deleteContactMock).toHaveBeenCalledWith('c1'));
  await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Contact deleted successfully!'));
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});

test('canceling deletion closes the modal without dispatching', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  const dialog = screen.getByRole('dialog', { hidden: false });
  fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/i }));
  expect(deleteContactMock).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});

test('pressing Escape closes the delete modal without dispatching (keyboard cancel)', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(deleteContactMock).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});

test('clicking the backdrop closes the delete modal without dispatching', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
  fireEvent.click(backdrop!);
  expect(deleteContactMock).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { hidden: false })).not.toBeInTheDocument();
});
