import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { config } from './lib/config.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { propertyRoutes } from './modules/property/property.routes.js';
import { calendarRoutes } from './modules/calendar/calendar.routes.js';
import { taskRoutes } from './modules/tasks/task.routes.js';
import { financeRoutes } from './modules/finance/finance.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { syncScheduler } from './services/sync-scheduler.js';

const app = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
    transport:
      config.nodeEnv === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
});

// Register plugins
await app.register(cors, {
  origin: config.frontendUrl,
  credentials: true,
});

await app.register(cookie);

await app.register(jwt, {
  secret: config.jwtSecret,
  sign: {
    expiresIn: '15m',
  },
});

await app.register(sensible);

// Health check
app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(propertyRoutes, { prefix: '/api/properties' });
await app.register(calendarRoutes, { prefix: '/api/calendar' });
await app.register(taskRoutes, { prefix: '/api/tasks' });
await app.register(financeRoutes, { prefix: '/api/finance' });
await app.register(dashboardRoutes, { prefix: '/api/dashboard' });

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);

  const statusCode = error.statusCode ?? 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  reply.status(statusCode).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message,
    },
  });
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Server running at http://${config.host}:${config.port}`);

    // Start automatic calendar sync (every 30 minutes)
    syncScheduler.start();
    app.log.info('Calendar sync scheduler started (every 30 minutes)');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  syncScheduler.stop();
  app.close();
});

process.on('SIGINT', () => {
  syncScheduler.stop();
  app.close();
});

start();

