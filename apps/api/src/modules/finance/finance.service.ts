import { db } from '@unifiedstay/database';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { CreateExpenseInput, CreateRevenueInput } from '@unifiedstay/shared';
import type { ParsedPayout } from './payout-parser.js';
import type { ParsedPDFReport } from './pdf-parser.js';

interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueChange: number;
  expenseChange: number;
}

class FinanceService {
  async getSummary(
    userId: string,
    filters: { propertyId?: string; period?: string }
  ): Promise<FinanceSummary> {
    const properties = await db.property.findMany({
      where: {
        userId,
        ...(filters.propertyId ? { id: filters.propertyId } : {}),
      },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        revenueChange: 0,
        expenseChange: 0,
      };
    }

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Current month aggregations
    const [currentRevenue, currentExpenses, lastRevenue, lastExpenses] = await Promise.all([
      db.revenue.aggregate({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        _sum: { amount: true },
      }),
      db.revenue.aggregate({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = Number(currentRevenue._sum.amount ?? 0);
    const totalExpenses = Number(currentExpenses._sum.amount ?? 0);
    const lastTotalRevenue = Number(lastRevenue._sum.amount ?? 0);
    const lastTotalExpenses = Number(lastExpenses._sum.amount ?? 0);

    // Calculate percentage changes
    const revenueChange =
      lastTotalRevenue > 0
        ? Math.round(((totalRevenue - lastTotalRevenue) / lastTotalRevenue) * 100)
        : 0;

    const expenseChange =
      lastTotalExpenses > 0
        ? Math.round(((totalExpenses - lastTotalExpenses) / lastTotalExpenses) * 100)
        : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      revenueChange,
      expenseChange,
    };
  }

  async getExpenses(
    userId: string,
    filters: { propertyId?: string; category?: string; limit?: number }
  ) {
    const properties = await db.property.findMany({
      where: {
        userId,
        ...(filters.propertyId ? { id: filters.propertyId } : {}),
      },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    return db.expense.findMany({
      where: {
        propertyId: { in: propertyIds },
        ...(filters.category ? { category: filters.category as any } : {}),
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
      take: filters.limit || 50,
    });
  }

  async createExpense(userId: string, input: CreateExpenseInput) {
    // Verify property ownership
    const property = await db.property.findFirst({
      where: { id: input.propertyId, userId },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    return db.expense.create({
      data: {
        propertyId: input.propertyId,
        category: input.category,
        amount: input.amount,
        date: input.date,
        description: input.description,
        receiptUrl: input.receiptUrl,
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async deleteExpense(userId: string, expenseId: string) {
    const expense = await db.expense.findFirst({
      where: {
        id: expenseId,
        property: { userId },
      },
    });

    if (!expense) {
      throw new Error('Expense not found');
    }

    await db.expense.delete({
      where: { id: expenseId },
    });
  }

  async getRevenues(userId: string, filters: { propertyId?: string; limit?: number }) {
    const properties = await db.property.findMany({
      where: {
        userId,
        ...(filters.propertyId ? { id: filters.propertyId } : {}),
      },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    return db.revenue.findMany({
      where: {
        propertyId: { in: propertyIds },
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
        reservation: {
          select: { id: true, guestName: true, channel: true },
        },
      },
      orderBy: { date: 'desc' },
      take: filters.limit || 50,
    });
  }

  async createRevenue(userId: string, input: CreateRevenueInput) {
    // Verify property ownership
    const property = await db.property.findFirst({
      where: { id: input.propertyId, userId },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    return db.revenue.create({
      data: {
        propertyId: input.propertyId,
        reservationId: input.reservationId,
        channel: input.channel,
        amount: input.amount,
        date: input.date,
        description: input.description,
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getPnLByProperty(userId: string, options: { start?: Date; end?: Date }) {
    const start = options.start || startOfMonth(new Date());
    const end = options.end || endOfMonth(new Date());

    const properties = await db.property.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
      },
    });

    const pnlData = [];

    for (const property of properties) {
      const [revenueAgg, expenseAgg] = await Promise.all([
        db.revenue.aggregate({
          where: {
            propertyId: property.id,
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        db.expense.aggregate({
          where: {
            propertyId: property.id,
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
      ]);

      const revenue = Number(revenueAgg._sum.amount ?? 0);
      const expenses = Number(expenseAgg._sum.amount ?? 0);

      pnlData.push({
        propertyId: property.id,
        propertyName: property.name,
        revenue,
        expenses,
        profit: revenue - expenses,
        margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
      });
    }

    return pnlData;
  }

  async importPayouts(userId: string, propertyId: string, payouts: ParsedPayout[]) {
    // Verify property ownership
    const property = await db.property.findFirst({
      where: { id: propertyId, userId },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    let imported = 0;
    let skipped = 0;

    for (const payout of payouts) {
      // Check for duplicates (same date, amount, and channel)
      const existing = await db.revenue.findFirst({
        where: {
          propertyId,
          date: payout.date,
          amount: payout.amount,
          channel: payout.channel,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create revenue entry
      await db.revenue.create({
        data: {
          propertyId,
          channel: payout.channel,
          amount: payout.amount,
          date: payout.date,
          description: payout.description,
        },
      });

      imported++;
    }

    return {
      imported,
      skipped,
      total: payouts.length,
    };
  }

  async getImportStatus(userId: string) {
    const properties = await db.property.findMany({
      where: { userId },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    // Get most recent revenue entry (as proxy for last import)
    const lastRevenue = await db.revenue.findFirst({
      where: { propertyId: { in: propertyIds } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Count total revenues
    const totalRevenues = await db.revenue.count({
      where: { propertyId: { in: propertyIds } },
    });

    const daysSinceLastImport = lastRevenue
      ? Math.floor((Date.now() - lastRevenue.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      lastImportAt: lastRevenue?.createdAt || null,
      daysSinceLastImport,
      totalRevenues,
      needsImport: daysSinceLastImport === null || daysSinceLastImport > 14,
    };
  }

  async importPDFReport(
    userId: string,
    report: ParsedPDFReport,
    propertyMappings: { pdfPropertyName: string; propertyId: string }[]
  ) {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const earning of report.properties) {
      // Find mapping for this property
      const mapping = propertyMappings.find(
        (m) => m.pdfPropertyName.toLowerCase() === earning.propertyName.toLowerCase()
      );

      if (!mapping) {
        errors.push(`No mapping found for "${earning.propertyName}"`);
        skipped++;
        continue;
      }

      // Verify property ownership
      const property = await db.property.findFirst({
        where: { id: mapping.propertyId, userId },
      });

      if (!property) {
        errors.push(`Property not found or not owned: ${mapping.propertyId}`);
        skipped++;
        continue;
      }

      // Check for duplicates (same property, channel, and amount within reasonable date range)
      const existingRevenue = await db.revenue.findFirst({
        where: {
          propertyId: mapping.propertyId,
          channel: report.channel,
          amount: earning.totalEarnings,
        },
      });

      if (existingRevenue) {
        skipped++;
        continue;
      }

      // Create revenue entry
      await db.revenue.create({
        data: {
          propertyId: mapping.propertyId,
          channel: report.channel,
          amount: earning.totalEarnings,
          date: new Date(), // Use current date or parse from report period
          description: `${report.channel === 'airbnb' ? 'Airbnb' : 'Vrbo'} earnings - ${earning.propertyName} (${report.reportPeriod || 'imported'})`,
        },
      });

      imported++;
    }

    return {
      imported,
      skipped,
      total: report.properties.length,
      errors: errors.length > 0 ? errors : undefined,
      reportSummary: {
        period: report.reportPeriod,
        totalGross: report.totalGrossEarnings,
        totalNet: report.totalNetEarnings,
      },
    };
  }
}

export const financeService = new FinanceService();

