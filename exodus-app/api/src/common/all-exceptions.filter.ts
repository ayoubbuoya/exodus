// Turns every error into a safe JSON response.
//
// - Our own errors (NotFoundException, ConflictException, ...) keep their status
//   and message, because we wrote those messages for users:
//     { "statusCode": 409, "message": "An account with this email already exists." }
// - Validation errors also list the fields:
//     { "statusCode": 400, "message": "Validation failed", "errors": [{ "field": "email", "message": "..." }] }
// - Anything unexpected (a bug, the database is down) is logged with its stack
//   trace and the client only gets a generic 500. Never leak internals.
import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

type FieldError = { field: string; message: string };

type ErrorBody = {
  statusCode: number;
  message: string;
  errors?: FieldError[];
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = toErrorBody(exception);
      if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`${request.method} ${request.originalUrl} failed: ${body.message}`, exception.stack);
      }
      response.status(body.statusCode).json(body);
      return;
    }

    const stack = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`Unexpected error on ${request.method} ${request.originalUrl}`, stack);
    const body: ErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Something went wrong. Please try again.",
    };
    response.status(body.statusCode).json(body);
  }
}

// Nest stores either a plain string or an object such as
// { message: "Validation failed", errors: [...] } inside an HttpException.
function toErrorBody(exception: HttpException): ErrorBody {
  const statusCode = exception.getStatus();
  const raw = exception.getResponse();
  if (typeof raw === "string") {
    return { statusCode, message: raw };
  }

  const details = raw as { message?: unknown; errors?: FieldError[] };
  let message = exception.message;
  if (typeof details.message === "string") {
    message = details.message;
  } else if (Array.isArray(details.message)) {
    // Nest's own exceptions may carry a list of messages; show them as one line.
    message = details.message.join(", ");
  }
  const body: ErrorBody = { statusCode, message };
  if (details.errors !== undefined) {
    body.errors = details.errors;
  }
  return body;
}
