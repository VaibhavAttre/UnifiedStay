import { FastifyReply } from 'fastify';
import type { ApiResponse } from '@unifiedstay/shared';

export function success<T>(reply: FastifyReply, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  reply.status(statusCode).send(response);
}

export function successWithMeta<T>(
  reply: FastifyReply,
  data: T,
  meta: { page?: number; limit?: number; total?: number },
  statusCode = 200
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };
  reply.status(statusCode).send(response);
}

export function error(
  reply: FastifyReply,
  code: string,
  message: string,
  statusCode = 400
): void {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
    },
  };
  reply.status(statusCode).send(response);
}

