"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { getTransactionHistory, setTransactionFilter, clearTransactionFilters } from "@/store/slices/accountSlice";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RefreshCw, ReceiptText } from "lucide-react";
import TransactionFilters from "@/components/dashboard/TransactionFilters";
import TransactionTable from "@/components/dashboard/TransactionTable";
import type { TransactionFilters as TransactionFiltersType } from "@/store/slices/accountSlice";

export default function TransactionsPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { status, transactions } = useSelector(
    (state: RootState) => state.account,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<TransactionFiltersType>({
    type: 'all',
    asset: 'all',
    direction: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (status?.publicKey) {
      dispatch(getTransactionHistory(status.publicKey));
    }
  }, [dispatch, status?.publicKey]);

  const handleFilterChange = (newFilters: Partial<TransactionFiltersType>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    dispatch(setTransactionFilter(newFilters));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({
      type: 'all',
      asset: 'all',
      direction: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
    });
    dispatch(clearTransactionFilters());
    setCurrentPage(1);
  };

  const filteredTransactions = transactions.transactions.filter((tx) => {
    if (filters.status !== 'all') {
      const txStatus = tx.status || (tx.successful ? 'success' : 'failed');
      if (txStatus !== filters.status) return false;
    }
    
    if (filters.type !== 'all' && tx.operations.length > 0) {
      const mainOpType = tx.operations[0].type;
      if (mainOpType !== filters.type) return false;
    }

    if (filters.asset !== 'all' && tx.operations.length > 0) {
      const mainOpAsset = tx.operations[0].asset;
      if (mainOpAsset !== filters.asset) return false;
    }

    if (filters.startDate) {
      const txDate = new Date(tx.created_at);
      const filterDate = new Date(filters.startDate);
      if (txDate < filterDate) return false;
    }

    if (filters.endDate) {
      const txDate = new Date(tx.created_at);
      const filterDate = new Date(filters.endDate);
      filterDate.setHours(23, 59, 59, 999);
      if (txDate > filterDate) return false;
    }

    return true;
  });

  if (transactions.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Transaction History</h1>
        <div className="text-center">Loading transactions...</div>
      </div>
    );
  }

  if (transactions.error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Transaction History</h1>
        <Card className="border-red-200 dark:border-red-900">
          <div role="alert" className="space-y-4">
            <p className="text-red-700 dark:text-red-300">Error: {transactions.error}</p>
            {status?.publicKey && (
              <Button
                type="button"
                onClick={() => dispatch(getTransactionHistory(status.publicKey))}
                className="inline-flex items-center gap-2"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        {status?.publicKey && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => dispatch(getTransactionHistory(status.publicKey))}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>

      <div className="mb-6">
        <TransactionFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      {filteredTransactions.length === 0 && transactions.transactions.length === 0 ? (
        <EmptyState
          icon={<ReceiptText aria-hidden="true" className="h-8 w-8" />}
          title="No transactions yet"
          description="Your completed transactions will appear here. Start with a wallet transfer or payment."
          action={{ label: "Go to dashboard", onClick: () => router.push("/dashboard") }}
        />
      ) : filteredTransactions.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">No transactions match your filters</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
            >
              Clear filters
            </Button>
          </div>
        </Card>
      ) : (
        <TransactionTable
          transactions={filteredTransactions}
          isLoading={transactions.isLoading}
          error={transactions.error}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={filteredTransactions.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
