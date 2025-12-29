import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, getCurrentUserId } from '../../lib/auth.js';
import { success, error } from '../../lib/response.js';
import { taskService } from './task.service.js';
import { createTaskSchema, updateTaskSchema } from '@unifiedstay/shared';

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth to all routes
  fastify.addHook('preHandler', authenticate);

  // Get all tasks
  fastify.get('/', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const query = request.query as { status?: string; propertyId?: string; type?: string };
    const tasks = await taskService.getAll(userId, query);
    success(reply, tasks);
  });

  // Get single task
  fastify.get('/:id', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const { id } = request.params as { id: string };

    try {
      const task = await taskService.getById(userId, id);
      success(reply, task);
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Create task
  fastify.post('/', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = createTaskSchema.parse(request.body);
      const task = await taskService.create(userId, body);
      success(reply, task, 201);
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

  // Update task
  fastify.patch('/:id', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const { id } = request.params as { id: string };
      const body = updateTaskSchema.parse(request.body);
      const task = await taskService.update(userId, id, body);
      success(reply, task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        error(reply, 'VALIDATION_ERROR', err.errors[0].message, 400);
        return;
      }
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Delete task
  fastify.delete('/:id', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const { id } = request.params as { id: string };

    try {
      await taskService.delete(userId, id);
      success(reply, { message: 'Task deleted successfully' });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Generate tasks for upcoming checkouts
  fastify.post('/generate', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const result = await taskService.generateTurnoverTasks(userId);
      success(reply, result);
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'ERROR', err.message, 400);
      }
    }
  });
};

