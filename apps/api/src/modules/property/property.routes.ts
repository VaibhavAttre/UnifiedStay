import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, getCurrentUserId } from '../../lib/auth.js';
import { success, error } from '../../lib/response.js';
import { propertyService } from './property.service.js';
import { createPropertySchema, updatePropertySchema, createChannelMappingSchema } from '@unifiedstay/shared';

export const propertyRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth to all routes
  fastify.addHook('preHandler', authenticate);

  // Get all properties for user
  fastify.get('/', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const properties = await propertyService.getAll(userId);
    success(reply, properties);
  });

  // Get single property
  fastify.get('/:id', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const { id } = request.params as { id: string };

    try {
      const property = await propertyService.getById(id, userId);
      success(reply, property);
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Create property
  fastify.post('/', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const body = createPropertySchema.parse(request.body);
      const property = await propertyService.create(userId, body);
      success(reply, property, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        error(reply, 'VALIDATION_ERROR', err.errors[0].message, 400);
        return;
      }
      throw err;
    }
  });

  // Update property
  fastify.put('/:id', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const { id } = request.params as { id: string };
      const body = updatePropertySchema.parse(request.body);
      const property = await propertyService.update(id, userId, body);
      success(reply, property);
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

  // Delete property
  fastify.delete('/:id', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const { id } = request.params as { id: string };

    try {
      await propertyService.delete(id, userId);
      success(reply, { message: 'Property deleted successfully' });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });

  // Add channel mapping
  fastify.post('/:id/channels', async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const { id } = request.params as { id: string };
      const body = createChannelMappingSchema.parse(request.body);
      const mapping = await propertyService.addChannelMapping(id, userId, body);
      success(reply, mapping, 201);
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

  // Delete channel mapping
  fastify.delete('/:id/channels/:channelId', async (request, reply) => {
    const userId = getCurrentUserId(request);
    const { id, channelId } = request.params as { id: string; channelId: string };

    try {
      await propertyService.removeChannelMapping(id, userId, channelId);
      success(reply, { message: 'Channel removed successfully' });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'NOT_FOUND', err.message, 404);
      }
    }
  });
};

