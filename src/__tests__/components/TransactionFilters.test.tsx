import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionFilters from '@/components/dashboard/TransactionFilters';
import type { TransactionFilters as TransactionFiltersType } from '@/store/slices/accountSlice';

describe('TransactionFilters Component', () => {
  const mockFilters: TransactionFiltersType = {
    type: 'all',
    asset: 'all',
    direction: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
  };

  const mockOnFilterChange = vi.fn();
  const mockOnClearFilters = vi.fn();

  it('renders all filter inputs', () => {
    render(
      <TransactionFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    expect(screen.getByDisplayValue('all types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('all assets')).toBeInTheDocument();
    expect(screen.getByDisplayValue('all directions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('all statuses')).toBeInTheDocument();
  });

  it('renders status filter dropdown with correct options', () => {
    render(
      <TransactionFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const statusSelects = screen.getAllByDisplayValue(/all statuses|Success|Pending|Failed/);
    const statusSelect = statusSelects.find(el => el.getAttribute('value') === 'all');
    
    expect(statusSelect).toBeInTheDocument();
    
    const options = statusSelect?.querySelectorAll('option');
    expect(options?.length).toBe(4); // all, success, pending, failed
  });

  it('calls onFilterChange when status filter is changed', () => {
    render(
      <TransactionFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const statusSelects = screen.getAllByDisplayValue('all statuses');
    const statusSelect = statusSelects[0] as HTMLSelectElement;
    
    fireEvent.change(statusSelect, { target: { value: 'pending' } });
    
    expect(mockOnFilterChange).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('distinguishes between success, pending, and failed status options', () => {
    render(
      <TransactionFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const statusSelects = screen.getAllByDisplayValue('all statuses');
    const statusSelect = statusSelects[0] as HTMLSelectElement;
    
    const options = Array.from(statusSelect.options).map(o => o.value);
    expect(options).toContain('all');
    expect(options).toContain('success');
    expect(options).toContain('pending');
    expect(options).toContain('failed');
  });

  it('shows clear all button when filters are active', () => {
    const activeFilters: TransactionFiltersType = {
      type: 'payment',
      asset: 'XLM',
      direction: 'sent',
      status: 'pending',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    render(
      <TransactionFilters
        filters={activeFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const clearButton = screen.getByText('Clear all');
    expect(clearButton).toBeInTheDocument();
  });

  it('hides clear all button when no filters are applied', () => {
    render(
      <TransactionFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls onClearFilters when clear all button is clicked', () => {
    const activeFilters: TransactionFiltersType = {
      type: 'payment',
      asset: 'all',
      direction: 'all',
      status: 'failed',
      startDate: '',
      endDate: '',
    };

    render(
      <TransactionFilters
        filters={activeFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const clearButton = screen.getByText('Clear all');
    fireEvent.click(clearButton);
    
    expect(mockOnClearFilters).toHaveBeenCalled();
  });

  it('allows filtering by each status option independently', () => {
    const statuses = ['success', 'pending', 'failed'];
    
    statuses.forEach(status => {
      const { unmount } = render(
        <TransactionFilters
          filters={mockFilters}
          onFilterChange={mockOnFilterChange}
          onClearFilters={mockOnClearFilters}
        />
      );

      const statusSelects = screen.getAllByDisplayValue('all statuses');
      const statusSelect = statusSelects[0] as HTMLSelectElement;
      
      fireEvent.change(statusSelect, { target: { value: status } });
      
      expect(mockOnFilterChange).toHaveBeenCalledWith({ status });
      unmount();
      mockOnFilterChange.mockClear();
    });
  });
});
