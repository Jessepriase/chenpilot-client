import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TransactionTable from '@/components/dashboard/TransactionTable';
import type { StellarTransaction } from '@/types';

describe('TransactionTable Status Display', () => {
  const mockTransactions: StellarTransaction[] = [
    {
      id: '1',
      hash: '0x1234567890abcdef1234567890abcdef12345678',
      ledger: 100,
      created_at: '2024-01-15T10:00:00Z',
      source_account: '0xsource1',
      fee_charged: '100',
      operation_count: 1,
      successful: true,
      status: 'success',
      operations: [
        {
          id: 'op1',
          type: 'payment',
          amount: '1000',
          asset: 'XLM',
          source_account: '0xsource1',
        },
      ],
    },
    {
      id: '2',
      hash: '0xabcdef1234567890abcdef1234567890abcdef12',
      ledger: 101,
      created_at: '2024-01-15T11:00:00Z',
      source_account: '0xsource2',
      fee_charged: '100',
      operation_count: 1,
      successful: false,
      status: 'pending',
      operations: [
        {
          id: 'op2',
          type: 'payment',
          amount: '500',
          asset: 'USDC',
          source_account: '0xsource2',
        },
      ],
    },
    {
      id: '3',
      hash: '0xfedcba9876543210fedcba9876543210fedcba98',
      ledger: 102,
      created_at: '2024-01-15T12:00:00Z',
      source_account: '0xsource3',
      fee_charged: '100',
      operation_count: 1,
      successful: false,
      status: 'failed',
      operations: [
        {
          id: 'op3',
          type: 'create_account',
          amount: '2000',
          asset: 'XLM',
          source_account: '0xsource3',
        },
      ],
    },
  ];

  const defaultProps = {
    isLoading: false,
    error: null,
    currentPage: 1,
    pageSize: 10,
    totalCount: 3,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('displays success status with green checkmark', () => {
    render(
      <TransactionTable
        transactions={[mockTransactions[0]]}
        {...defaultProps}
      />
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
    const successText = screen.getByText('Success');
    expect(successText).toHaveClass('text-green-400');
  });

  it('displays pending status with spinning loader', () => {
    render(
      <TransactionTable
        transactions={[mockTransactions[1]]}
        {...defaultProps}
      />
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    const pendingText = screen.getByText('Pending');
    expect(pendingText).toHaveClass('text-yellow-400');
  });

  it('displays failed status with alert icon', () => {
    render(
      <TransactionTable
        transactions={[mockTransactions[2]]}
        {...defaultProps}
      />
    );

    expect(screen.getByText('Failed')).toBeInTheDocument();
    const failedText = screen.getByText('Failed');
    expect(failedText).toHaveClass('text-red-400');
  });

  it('distinguishes between pending and failed transactions', () => {
    render(
      <TransactionTable
        transactions={mockTransactions.slice(1)}
        {...defaultProps}
        totalCount={2}
      />
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    
    const pendingText = screen.getByText('Pending');
    const failedText = screen.getByText('Failed');
    
    expect(pendingText).not.toEqual(failedText);
  });

  it('falls back to successful flag when status is not provided', () => {
    const txWithoutStatus: StellarTransaction = {
      ...mockTransactions[0],
      status: undefined,
      successful: true,
    };

    render(
      <TransactionTable
        transactions={[txWithoutStatus]}
        {...defaultProps}
      />
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('shows all three status types when mixed transactions are present', () => {
    render(
      <TransactionTable
        transactions={mockTransactions}
        {...defaultProps}
        totalCount={3}
      />
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays transaction details correctly regardless of status', () => {
    render(
      <TransactionTable
        transactions={mockTransactions}
        {...defaultProps}
        totalCount={3}
      />
    );

    // Check that transaction hashes are displayed
    mockTransactions.forEach(tx => {
      const truncatedHash = tx.hash.substring(0, 8);
      expect(screen.getByText(truncatedHash)).toBeInTheDocument();
    });
  });

  it('renders with pending status showing animation', () => {
    const { container } = render(
      <TransactionTable
        transactions={[mockTransactions[1]]}
        {...defaultProps}
      />
    );

    const pendingIcon = container.querySelector('.animate-spin');
    expect(pendingIcon).toBeInTheDocument();
  });
});
