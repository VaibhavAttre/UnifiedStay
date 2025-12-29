import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, getCurrentUserId } from '../../lib/auth.js';
import { success, error } from '../../lib/response.js';
import { financeService } from './finance.service.js';
import { createExpenseSchema, createRevenueSchema } from '@unifiedstay/shared';
import { parsePayoutCSV } from './payout-parser.js';
import { parseEarningsPDF } from './pdf-parser.js';

export const financeRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth to all routes
  fastify.addHook('preHandler', authenticate);

  // Get finance summary
  fastify.get('/summary', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { propertyId?: string; period?: string };
    const summary = await financeService.getSummary(userId, query);
    success(reply, summary);
  });

  // Get expenses
  fastify.get('/expenses', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { propertyId?: string; category?: string; limit?: string };
    const expenses = await financeService.getExpenses(userId, {
      propertyId: query.propertyId,
      category: query.category,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    success(reply, expenses);
  });

  // Create expense
  fastify.post('/expenses', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = createExpenseSchema.parse(request.body);
      const expense = await financeService.createExpense(userId, body);
      success(reply, expense, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        error(reply, 'VALIDATION_ERROR', err.errors[0].message, 400);
        return;
      }
      if (err instanceof Error) {
        error(reply, 'ERROR', err.message, 400);
      }
    }
  });

  // Delete expense
  fastify.delete('/expenses/:id', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const { id } = request.params as { id: string };

    try {
      await financeService.deleteExpense(userId, id);
      success(reply, { message: 'Expense deleted successfully' });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Get revenues
  fastify.get('/revenues', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { propertyId?: string; limit?: string };
    const revenues = await financeService.getRevenues(userId, {
      propertyId: query.propertyId,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    success(reply, revenues);
  });

  // Create revenue
  fastify.post('/revenues', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = createRevenueSchema.parse(request.body);
      const revenue = await financeService.createRevenue(userId, body);
      success(reply, revenue, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        error(reply, 'VALIDATION_ERROR', err.errors[0].message, 400);
        return;
      }
      if (err instanceof Error) {
        error(reply, 'ERROR', err.message, 400);
      }
    }
  });

  // Get P&L by property
  fastify.get('/pnl', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { start?: string; end?: string };
    const pnl = await financeService.getPnLByProperty(userId, {
      start: query.start ? new Date(query.start) : undefined,
      end: query.end ? new Date(query.end) : undefined,
    });
    success(reply, pnl);
  });

  // Import payouts from CSV
  fastify.post('/import', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = request.body as { 
        csvContent: string; 
        propertyId: string;
        channel?: 'airbnb' | 'vrbo';
      };

      if (!body.csvContent || !body.propertyId) {
        error(reply, 'VALIDATION_ERROR', 'CSV content and property ID are required', 400);
        return;
      }

      // Parse CSV
      const payouts = parsePayoutCSV(body.csvContent, body.channel);
      
      if (payouts.length === 0) {
        error(reply, 'PARSE_ERROR', 'No valid payouts found in CSV. Please check the file format.', 400);
        return;
      }

      // Import payouts as revenue
      const result = await financeService.importPayouts(userId, body.propertyId, payouts);
      success(reply, result);
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'IMPORT_ERROR', err.message, 400);
      }
    }
  });

  // Get last import info
  fastify.get('/import/status', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const status = await financeService.getImportStatus(userId);
    success(reply, status);
  });

  // Import from PDF
  fastify.post('/import/pdf', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = request.body as { 
        pdfBase64: string;
        propertyMappings: { pdfPropertyName: string; propertyId: string }[];
      };

      if (!body.pdfBase64) {
        error(reply, 'VALIDATION_ERROR', 'PDF content is required', 400);
        return;
      }

      // Decode base64 PDF
      const pdfBuffer = Buffer.from(body.pdfBase64, 'base64');

      // Parse PDF
      const report = await parseEarningsPDF(pdfBuffer);

      if (report.properties.length === 0) {
        error(reply, 'PARSE_ERROR', 'Could not find any property earnings in the PDF. Please make sure this is an Airbnb or Vrbo earnings report.', 400);
        return;
      }

      // If no mappings provided, return the parsed data for mapping
      if (!body.propertyMappings || body.propertyMappings.length === 0) {
        success(reply, {
          needsMapping: true,
          report,
        });
        return;
      }

      // Import with mappings
      const result = await financeService.importPDFReport(userId, report, body.propertyMappings);
      success(reply, result);
    } catch (err) {
      console.error('PDF import error:', err);
      if (err instanceof Error) {
        error(reply, 'IMPORT_ERROR', err.message, 400);
      }
    }
  });
};

