// The global ValidationPipe settings: every request body and query string is
// checked against its DTO class before the controller runs.
import { BadRequestException, ValidationPipe, type ValidationError } from "@nestjs/common";

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Drop unknown fields and refuse requests that send them, so a client
    // cannot sneak in { "role": "ADMIN" } on sign-up.
    whitelist: true,
    forbidNonWhitelisted: true,
    // Turn "?page=2" into the number 2, and run the DTOs' @Transform (trim, lower-case).
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        message: "Validation failed",
        errors: errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints ?? {}).join(", "),
        })),
      }),
  });
}
