'use client';

import React from 'react';
import { TransactionFilters } from '@/store/slices/accountSlice';
import { Card } from '@/components/ui/Card';
import { X } from 'lucide-react';

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFilterChange: (filters: Partial<TransactionFilters>) => void;
  onClearFilters: () => void;
}

export default function TransactionFilterComponent({
  filters,
  onFilterChange,
  onClearFilters,
}: TransactionFiltersProps) {
  const isFiltered = 
    filters.type !== 'all' || 
    filters.asset !== 'all' || 
    filters.direction !== 'all' ||
    filters.status !== 'all' ||
    filters.startDate !== '' ||
    filters.endDate !== '';

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Filters</h3>
        {isFiltered && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <X className="h-3 w-3" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Type Filter */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-400">Type</label>
          <select
            value={filters.type}
            onChange={(e) => onFilterChange({ type: e.target.value })}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white hover:border-gray-500 transition-colors focus:outline-none focus:border-blue-500"
          >
            <option value="all">All types</option>
            <option value="payment">Payment</option>
            <option value="create_account">Create Account</option>
            <option value="account_merge">Account Merge</option>
            <option value="manage_offer">Manage Offer</option>
            <option value="change_trust">Change Trust</option>
          </select>
        </div>

        {/* Asset Filter */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-400">Asset</label>
          <select
            value={filters.asset}
            onChange={(e) => onFilterChange({ asset: e.target.value })}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white hover:border-gray-500 transition-colors focus:outline-none focus:border-blue-500"
          >
            <option value="all">All assets</option>
            <option value="XLM">XLM</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="native">Native</option>
          </select>
        </div>

        {/* Direction Filter */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-400">Direction</label>
          <select
            value={filters.direction}
            onChange={(e) => onFilterChange({ direction: e.target.value })}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white hover:border-gray-500 transition-colors focus:outline-none focus:border-blue-500"
          >
            <option value="all">All directions</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-400">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white hover:border-gray-500 transition-colors focus:outline-none focus:border-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Start Date Filter */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-400">From</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ startDate: e.target.value })}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white hover:border-gray-500 transition-colors focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* End Date Filter */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-medium text-gray-400">To</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ endDate: e.target.value })}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white hover:border-gray-500 transition-colors focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </Card>
  );
}
