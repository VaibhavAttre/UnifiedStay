import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, getCurrentUserId } from '../../lib/auth.js';
import { success, error } from '../../lib/response.js';
import { calendarService } from './calendar.service.js';
import { syncScheduler } from '../../services/sync-scheduler.js';
import { createReservationSchema, createBlockSchema, dateRangeSchema } from '@unifiedstay/shared';

export const calendarRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth to all routes
  fastify.addHook('preHandler', authenticate);

  // Get calendar events for date range
  fastify.get('/events', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const query = request.query as { start?: string; end?: string; propertyId?: string };

      const startDate = query.start ? new Date(query.start) : new Date();
      const endDate = query.end ? new Date(query.end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const events = await calendarService.getEvents(userId, {
        start: startDate,
        end: endDate,
        propertyId: query.propertyId,
      });

      success(reply, events);
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'ERROR', err.message, 400);
      }
    }
  });

  // Get reservations
  fastify.get('/reservations', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { propertyId?: string; status?: string };
    const reservations = await calendarService.getReservations(userId, query);
    success(reply, reservations);
  });

  // Create manual reservation
  fastify.post('/reservations', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = createReservationSchema.parse(request.body);
      const reservation = await calendarService.createReservation(userId, body);
      success(reply, reservation, 201);
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

  // Create availability block
  fastify.post('/blocks', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = createBlockSchema.parse(request.body);
      const block = await calendarService.createBlock(userId, body);
      success(reply, block, 201);
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

  // Delete block
  fastify.delete('/blocks/:id', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const { id } = request.params as { id: string };
      await calendarService.deleteBlock(userId, id);
      success(reply, { message: 'Block deleted successfully' });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Trigger sync for a channel
  fastify.post('/sync/:channelMappingId', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const { channelMappingId } = request.params as { channelMappingId: string };
      const result = await calendarService.syncChannel(userId, channelMappingId);
      success(reply, result);
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'SYNC_ERROR', err.message, 400);
      }
    }
  });

  // Get conflicts
  fastify.get('/conflicts', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { propertyId?: string };
    const conflicts = await calendarService.getConflicts(userId, query.propertyId);
    success(reply, conflicts);
  });

  // Get sync status (auto-sync info)
  fastify.get('/sync/status', async (request, reply) => {
    const status = syncScheduler.getStatus();
    success(reply, status);
  });

  // Trigger sync for all channels (manual)
  fastify.post('/sync/all', async (request, reply) => {
    try {
      const results = await syncScheduler.runSync();
      success(reply, {
        message: 'Sync completed',
        results,
      });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'SYNC_ERROR', err.message, 400);
      }
    }
  });
};

