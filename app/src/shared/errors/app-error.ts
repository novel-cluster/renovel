import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Base application error. Thrown from the domain/application layers with a
 * stable machine-readable `code` and an HTTP `status`; the presentation error
 * middleware ([presentation/middleware/error.middleware.ts]) maps it to a response.
 *
 * Domain code must not import Hono `Context`; it only throws these.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: ContentfulStatusCode = 500,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super('not_found', message, 404)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input') {
    super('validation_error', message, 400)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('unauthorized', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('forbidden', message, 403)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super('conflict', message, 409)
  }
}
