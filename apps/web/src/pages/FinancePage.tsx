import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, TrendingUp, TrendingDown, DollarSign, Loader2, Receipt, Upload, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { AddExpenseModal } from '@/components/finance/AddExpenseModal';
import { ImportPayoutsModal } from '@/components/finance/ImportPayoutsModal';
import type { ExpenseCategory } from '@unifiedstay/shared';

interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueChange: number;
  expenseChange: number;
}

interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string;
  property: { id: string; name: string };
}

const categoryColors: Record<ExpenseCategory, string> = {
  cleaning: 'bg-blue-500',
  maintenance: 'bg-amber-500',
  supplies: 'bg-green-500',
  utilities: 'bg-purple-500',
  mortgage: 'bg-red-500',
  insurance: 'bg-pink-500',
  taxes: 'bg-indigo-500',
  marketing: 'bg-cyan-500',
  software: 'bg-orange-500',
  other: 'bg-gray-500',
};

export function FinancePage() {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/properties'),
  });

  const { data: importStatus } = useQuery({
    queryKey: ['import-status'],
    queryFn: () => api.get<{ 
      lastImportAt: string | null; 
      daysSinceLastImport: number | null;
      totalRevenues: number;
      needsImport: boolean;
    }>('/finance/import/status'),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['finance-summary', selectedProperty],
    queryFn: () =>
      api.get<FinanceSummary>(
        `/finance/summary${selectedProperty !== 'all' ? `?propertyId=${selectedProperty}` : ''}`
      ),
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', selectedProperty],
    queryFn: () =>
      api.get<Expense[]>(
        `/finance/expenses${selectedProperty !== 'all' ? `?propertyId=${selectedProperty}` : ''}`
      ),
  });

  const isLoading = summaryLoading || expensesLoading;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Finance</h1>
          <p className="text-muted-foreground">Track revenue and expenses</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="all">All Properties</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border font-medium hover:bg-accent transition-colors"
          >
            <Upload size={18} />
            Import Payouts
          </button>

          <button
            onClick={() => setShowAddExpense(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Import Reminder Banner */}
      {importStatus?.needsImport && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              {importStatus.lastImportAt
                ? `It's been ${importStatus.daysSinceLastImport} days since your last payout import`
                : 'You haven\'t imported any payouts yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              Import your Airbnb/Vrbo CSV to keep your finances up to date
            </p>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
          >
            Import Now
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                {(summary?.revenueChange ?? 0) !== 0 && (
                  <div
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      (summary?.revenueChange ?? 0) > 0 ? 'text-green-500' : 'text-destructive'
                    )}
                  >
                    {(summary?.revenueChange ?? 0) > 0 ? (
                      <TrendingUp size={16} />
                    ) : (
                      <TrendingDown size={16} />
                    )}
                    {Math.abs(summary?.revenueChange ?? 0)}%
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary?.totalRevenue ?? 0)}
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                {(summary?.expenseChange ?? 0) !== 0 && (
                  <div
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      (summary?.expenseChange ?? 0) > 0 ? 'text-destructive' : 'text-green-500'
                    )}
                  >
                    {(summary?.expenseChange ?? 0) > 0 ? (
                      <TrendingUp size={16} />
                    ) : (
                      <TrendingDown size={16} />
                    )}
                    {Math.abs(summary?.expenseChange ?? 0)}%
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(summary?.totalExpenses ?? 0)}
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <DollarSign size={18} className="text-muted-foreground" />
              </div>
              <p
                className={cn(
                  'text-2xl font-bold',
                  (summary?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'
                )}
              >
                {formatCurrency(summary?.netProfit ?? 0)}
              </p>
            </div>
          </div>

          {/* Recent Expenses */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Recent Expenses</h2>
            </div>

            {expenses?.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No expenses recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {expenses?.slice(0, 10).map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-3 h-3 rounded-full', categoryColors[expense.category])} />
                      <div>
                        <p className="font-medium capitalize">{expense.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {expense.property.name}
                          {expense.description && ` - ${expense.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-destructive">
                        -{formatCurrency(expense.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Expense Modal */}
      <AddExpenseModal open={showAddExpense} onClose={() => setShowAddExpense(false)} />

      {/* Import Payouts Modal */}
      <ImportPayoutsModal open={showImportModal} onClose={() => setShowImportModal(false)} />
    </div>
  );
}

