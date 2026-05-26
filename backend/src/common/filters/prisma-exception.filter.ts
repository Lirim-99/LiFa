import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";

/**
 * Maps Prisma errors to HTTP responses. Runs before HttpExceptionFilter so the
 * domain layer doesn't need to translate every Prisma error code manually.
 *
 *   P2002 (unique constraint)   → 409 Conflict
 *   P2025 (record not found)    → 404 Not Found
 *   P2003 (FK violation)        → 400 Bad Request
 *   P2000 (value too long)      → 400 Bad Request
 *   anything else               → 500 (logged with code for debugging)
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Database error";
    let errorName = "PrismaError";

    if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = "Invalid query input";
      errorName = "PrismaValidationError";
    } else {
      switch (exception.code) {
        case "P2002": {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[] | string | undefined) ?? "field";
          const fields = Array.isArray(target) ? target.join(", ") : target;
          message = `Unique constraint violation on: ${fields}`;
          errorName = "ConflictError";
          break;
        }
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          message = (exception.meta?.cause as string | undefined) ?? "Record not found";
          errorName = "NotFoundError";
          break;
        case "P2003":
          status = HttpStatus.BAD_REQUEST;
          message = "Foreign key constraint violation";
          errorName = "BadRequestError";
          break;
        case "P2000":
          status = HttpStatus.BAD_REQUEST;
          message = "Value too long for column";
          errorName = "BadRequestError";
          break;
        default:
          this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
