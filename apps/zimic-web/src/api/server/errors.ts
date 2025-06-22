import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, ZodIssue } from 'zod';

export interface ErrorResponseBody {
  code: string;
  message: string;
}

export interface ValidationErrorResponseBody extends ErrorResponseBody {
  issues: ZodIssue[];
}

export function handleServerError(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Validation error',
      issues: error.issues,
    } satisfies ValidationErrorResponseBody);
  }

  request.log.error(error, 'Internal server error');

  return reply.status(500).send({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  } satisfies ErrorResponseBody);
}
