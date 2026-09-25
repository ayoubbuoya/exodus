// Every successful response has the same shape, so the web app reads them all the same way:
//
//   { "statusCode": 200, "message": "Wallet loaded", "data": { ... } }
//
// Errors have the same outer shape without `data` (see AllExceptionsFilter).
import {
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { map, type Observable } from "rxjs";

const RESPONSE_MESSAGE_KEY = "responseMessage";

// @ResponseMessage("Logged in") sets the `message` of a route's success response.
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

export type ApiEnvelope<T> = {
  statusCode: number;
  message: string;
  data: T;
};

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<unknown>> {
    const message = this.reflector.get<string | undefined>(RESPONSE_MESSAGE_KEY, context.getHandler()) ?? "OK";
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(map((data: unknown) => ({ statusCode: response.statusCode, message, data })));
  }
}
