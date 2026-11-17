/**
 * Error Handler Middleware
 * 
 * Global error handling for the API.
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import logger from '../config/logger';
import { isDevelopment } from '../config/env';

/**
 * Custom API error
 */
export class APIError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public code?: string
    ) {
        super(message);
        this.name = 'APIError';
    }
}

/**
 * Error response format
 */
interface ErrorResponse {
    error: string;
    message: string;
    code?: string;
    details?: any;
    stack?: string;
}

/**
 * Global error handler
 */
export async function errorHandler(
    error: FastifyError | Error,
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Log error
    logger.error(
        {
            err: error,
            req: {
                method: request.method,
                url: request.url,
                params: request.params,
                query: request.query,
                headers: request.headers,
            },
        },
        'Request error'
    );

    // Handle Zod validation errors
    if (error instanceof ZodError) {
        return reply.status(400).send({
            error: 'Validation Error',
            message: 'Invalid request data',
            details: error.issues,
        });
    }

    // Handle custom API errors
    if (error instanceof APIError) {
        return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
            code: error.code,
        });
    }

    // Handle Fastify errors
    if ('statusCode' in error) {
        const statusCode = error.statusCode || 500;
        const response: ErrorResponse = {
            error: error.name || 'Error',
            message: error.message || 'An error occurred',
            code: error.code,
        };

        if (isDevelopment && error.stack) {
            response.stack = error.stack;
        }

        return reply.status(statusCode).send(response);
    }

    // Handle unknown errors
    const response: ErrorResponse = {
        error: 'Internal Server Error',
        message: isDevelopment
            ? error.message
            : 'An unexpected error occurred',
    };

    if (isDevelopment && error.stack) {
        response.stack = error.stack;
    }

    return reply.status(500).send(response);
}

/**
 * Not found handler
 */
export async function notFoundHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    return reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
    });
}
