import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  Building2,
  Loader2,
} from 'lucide-react';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import type { DashboardSummary } from '@unifiedstay/shared';

export function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    {
      label: 'Upcoming Check-ins',
      value: summary?.upcomingCheckIns ?? 0,
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Upcoming Check-outs',
      value: summary?.upcomingCheckOuts ?? 0,
      icon: Calendar,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Pending Tasks',
      value: summary?.pendingTasks ?? 0,
      icon: ClipboardList,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Active Conflicts',
      value: summary?.activeConflicts ?? 0,
      icon: AlertTriangle,
      color: summary?.activeConflicts ? 'text-destructive' : 'text-green-500',
      bgColor: summary?.activeConflicts ? 'bg-destructive/10' : 'bg-green-500/10',
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-card rounded-xl border border-border p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue & Occupancy Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Monthly Revenue */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Monthly Revenue</h3>
            <div className="flex items-center gap-1 text-sm text-green-500">
              <ArrowUpRight size={16} />
              <span>12%</span>
            </div>
          </div>
          <p className="text-3xl font-bold mb-1">
            {formatCurrency(summary?.monthlyRevenue ?? 0)}
          </p>
          <p className="text-sm text-muted-foreground">
            Expenses: {formatCurrency(summary?.monthlyExpenses ?? 0)}
          </p>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Occupancy Rate</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>This month</span>
            </div>
          </div>
          <p className="text-3xl font-bold mb-3">
            {Math.round((summary?.occupancyRate ?? 0) * 100)}%
          </p>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${(summary?.occupancyRate ?? 0) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href="/properties"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-center"
          >
            <Building2 className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Add Property</span>
          </a>
          <a
            href="/calendar"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-center"
          >
            <Calendar className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">View Calendar</span>
          </a>
          <a
            href="/tasks"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-center"
          >
            <ClipboardList className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Manage Tasks</span>
          </a>
          <a
            href="/finance"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-center"
          >
            <DollarSign className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Add Expense</span>
          </a>
        </div>
      </div>
    </div>
  );
}

