import { FastifyPluginAsync } from 'fastify';
import { authenticate, getCurrentUserId } from '../../lib/auth.js';
import { success } from '../../lib/response.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth to all routes
  fastify.addHook('preHandler', authenticate);

  // Get dashboard summary
  fastify.get('/summary', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const summary = await dashboardService.getSummary(userId);
    success(reply, summary);
  });
};

