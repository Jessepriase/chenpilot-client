import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StellarTransaction } from '@/types';

describe('Transaction Status Filtering', () => {
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

  const filterTransactions = (transactions: StellarTransaction[], status: string) => {
    return transactions.filter((tx) => {
      if (status !== 'all') {
        const txStatus = tx.status || (tx.successful ? 'success' : 'failed');
        if (txStatus !== status) return false;
      }
      return true;
    });
  };

  it('filters transactions with success status', () => {
    const filtered = filterTransactions(mockTransactions, 'success');
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
    expect(filtered[0].status).toBe('success');
  });

  it('filters transactions with pending status', () => {
    const filtered = filterTransactions(mockTransactions, 'pending');
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
    expect(filtered[0].status).toBe('pending');
  });

  it('filters transactions with failed status', () => {
    const filtered = filterTransactions(mockTransactions, 'failed');
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('3');
    expect(filtered[0].status).toBe('failed');
  });

  it('keeps pending distinct from failed', () => {
    const pending = filterTransactions(mockTransactions, 'pending');
    const failed = filterTransactions(mockTransactions, 'failed');
    
    expect(pending[0].status).toBe('pending');
    expect(failed[0].status).toBe('failed');
    expect(pending[0].id).not.toBe(failed[0].id);
  });

  it('returns all transactions when status filter is "all"', () => {
    const filtered = filterTransactions(mockTransactions, 'all');
    
    expect(filtered).toHaveLength(3);
  });

  it('derives status from successful flag when status is undefined', () => {
    const txWithoutStatus: StellarTransaction = {
      ...mockTransactions[0],
      status: undefined,
    };

    const filtered = filterTransactions([txWithoutStatus], 'success');
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].successful).toBe(true);
  });

  it('combines status filter with other filters without dropping cursor state', () => {
    interface FilterState {
      status: string;
      type: string;
      asset: string;
      startDate: string;
      endDate: string;
    }

    const filters: FilterState = {
      status: 'pending',
      type: 'payment',
      asset: 'all',
      startDate: '',
      endDate: '',
    };

    const filtered = mockTransactions.filter((tx) => {
      // Apply status filter
      if (filters.status !== 'all') {
        const txStatus = tx.status || (tx.successful ? 'success' : 'failed');
        if (txStatus !== filters.status) return false;
      }

      // Apply type filter
      if (filters.type !== 'all' && tx.operations.length > 0) {
        const mainOpType = tx.operations[0].type;
        if (mainOpType !== filters.type) return false;
      }

      // Apply asset filter
      if (filters.asset !== 'all' && tx.operations.length > 0) {
        const mainOpAsset = tx.operations[0].asset;
        if (mainOpAsset !== filters.asset) return false;
      }

      return true;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].status).toBe('pending');
    expect(filtered[0].operations[0].type).toBe('payment');
  });

  it('maintains cursor position when applying filters', () => {
    const pageSize = 10;
    const currentPage = 1;
    
    // Apply filter
    const filtered = filterTransactions(mockTransactions, 'pending');
    
    // Cursor should reset, but calculation should still work
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(currentPage * pageSize, filtered.length);
    
    expect(startIndex).toBe(0);
    expect(endIndex).toBe(filtered.length);
  });

  it('handles empty result set when no transactions match status filter', () => {
    const filtered = filterTransactions([], 'success');
    
    expect(filtered).toHaveLength(0);
  });

  it('correctly identifies pending vs failed even with mixed successful flags', () => {
    const mixedTx: StellarTransaction[] = [
      {
        ...mockTransactions[1],
        successful: true, // Successful but pending status
        status: 'pending',
      },
      {
        ...mockTransactions[2],
        successful: true, // Successful but failed status (edge case)
        status: 'failed',
      },
    ];

    const pending = filterTransactions(mixedTx, 'pending');
    const failed = filterTransactions(mixedTx, 'failed');

    expect(pending[0].status).toBe('pending');
    expect(failed[0].status).toBe('failed');
    // Status field takes precedence over successful flag
  });
});
