import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

const renderModal = (props: Partial<React.ComponentProps<typeof Modal>> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Test Confirmation"
      confirmLabel="Yes, delete"
      cancelLabel="No, keep"
      onConfirm={onConfirm}
      danger
      {...props}
    >
      <p>This will permanently remove the item. This action cannot be undone.</p>
    </Modal>
  );
  return { onConfirm, onClose };
};

test('renders confirm and cancel buttons with clear labels', () => {
  renderModal();
  expect(screen.getByRole('button', { name: /Yes, delete/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /No, keep/i })).toBeInTheDocument();
});

test('clicking confirm invokes onConfirm', () => {
  const { onConfirm } = renderModal();
  fireEvent.click(screen.getByRole('button', { name: /Yes, delete/i }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('clicking cancel invokes onClose (cancel behavior)', () => {
  const { onClose, onConfirm } = renderModal();
  fireEvent.click(screen.getByRole('button', { name: /No, keep/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('pressing Escape invokes onClose (keyboard cancel)', () => {
  const { onClose, onConfirm } = renderModal();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('clicking the backdrop invokes onClose (cancel behavior)', () => {
  const { onClose, onConfirm } = renderModal();
  const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
  fireEvent.click(backdrop!);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('does not render action buttons when onConfirm is not provided', () => {
  const { onClose } = renderModal({ onConfirm: undefined, title: undefined });
  expect(screen.queryByRole('button', { name: /Confirm/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
