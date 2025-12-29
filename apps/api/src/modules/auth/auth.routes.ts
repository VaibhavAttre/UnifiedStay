import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { success, error } from '../../lib/response.js';
import { loginSchema, registerSchema } from '@unifiedstay/shared';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      const result = await authService.register(body, fastify);
      success(reply, result, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        error(reply, 'VALIDATION_ERROR', err.errors[0].message, 400);
        return;
      }
      if (err instanceof Error) {
        error(reply, 'REGISTER_ERROR', err.message, 400);
        return;
      }
      throw err;
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const result = await authService.login(body, fastify);
      success(reply, result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        error(reply, 'VALIDATION_ERROR', err.errors[0].message, 400);
        return;
      }
      if (err instanceof Error) {
        error(reply, 'LOGIN_ERROR', err.message, 401);
        return;
      }
      throw err;
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        error(reply, 'UNAUTHORIZED', 'Invalid or expired token', 401);
      }
    }],
  }, async (request, reply) => {
    try {
      const user = await authService.getCurrentUser(request.user.id);
      success(reply, { user });
    } catch (err) {
      if (err instanceof Error) {
        error(reply, 'USER_NOT_FOUND', err.message, 404);
        return;
      }
      throw err;
    }
  });
};

