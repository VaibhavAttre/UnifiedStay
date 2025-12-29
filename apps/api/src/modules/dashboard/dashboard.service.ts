import { db } from '@unifiedstay/database';
import { startOfMonth, endOfMonth, addDays } from 'date-fns';
import type { DashboardSummary } from '@unifiedstay/shared';

class DashboardService {
  async getSummary(userId: string): Promise<DashboardSummary> {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Get user's properties
    const properties = await db.property.findMany({
      where: { userId },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return {
        upcomingCheckIns: 0,
        upcomingCheckOuts: 0,
        pendingTasks: 0,
        activeConflicts: 0,
        occupancyRate: 0,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
      };
    }

    // Get units for these properties
    const units = await db.unit.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const unitIds = units.map((u) => u.id);

    // Upcoming check-ins (next 7 days)
    const upcomingCheckIns = await db.reservation.count({
      where: {
        unitId: { in: unitIds },
        checkIn: {
          gte: today,
          lte: nextWeek,
        },
        status: { in: ['confirmed', 'pending'] },
      },
    });

    // Upcoming check-outs (next 7 days)
    const upcomingCheckOuts = await db.reservation.count({
      where: {
        unitId: { in: unitIds },
        checkOut: {
          gte: today,
          lte: nextWeek,
        },
        status: { in: ['confirmed', 'pending'] },
      },
    });

    // Pending tasks
    const pendingTasks = await db.task.count({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['pending', 'in_progress'] },
      },
    });

    // Monthly revenue
    const revenueAgg = await db.revenue.aggregate({
      where: {
        propertyId: { in: propertyIds },
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Monthly expenses
    const expenseAgg = await db.expense.aggregate({
      where: {
        propertyId: { in: propertyIds },
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Calculate occupancy rate (simplified - based on reservations this month)
    const daysInMonth = monthEnd.getDate();
    const totalPossibleDays = unitIds.length * daysInMonth;
    
    const reservations = await db.reservation.findMany({
      where: {
        unitId: { in: unitIds },
        status: { in: ['confirmed', 'completed'] },
        OR: [
          {
            checkIn: { gte: monthStart, lte: monthEnd },
          },
          {
            checkOut: { gte: monthStart, lte: monthEnd },
          },
          {
            AND: [
              { checkIn: { lte: monthStart } },
              { checkOut: { gte: monthEnd } },
            ],
          },
        ],
      },
    });

    let bookedDays = 0;
    for (const res of reservations) {
      const checkIn = new Date(res.checkIn) < monthStart ? monthStart : new Date(res.checkIn);
      const checkOut = new Date(res.checkOut) > monthEnd ? monthEnd : new Date(res.checkOut);
      const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      bookedDays += Math.max(0, days);
    }

    const occupancyRate = totalPossibleDays > 0 ? bookedDays / totalPossibleDays : 0;

    return {
      upcomingCheckIns,
      upcomingCheckOuts,
      pendingTasks,
      activeConflicts: 0, // TODO: Implement conflict detection
      occupancyRate: Math.min(1, occupancyRate),
      monthlyRevenue: Number(revenueAgg._sum.amount ?? 0),
      monthlyExpenses: Number(expenseAgg._sum.amount ?? 0),
    };
  }
}

export const dashboardService = new DashboardService();

