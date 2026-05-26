import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Catches every uncaught exception and shapes the response into a consistent
 * JSON error envelope. NestJS `HttpException`s keep their status + message;
 * everything else collapses to 500.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let errorName = "InternalServerError";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const obj = res as { message?: string | string[]; error?: string };
        message = obj.message ?? exception.message;
        errorName = obj.error ?? exception.name;
      } else {
        message = exception.message;
      }
      if (errorName === "InternalServerError") errorName = exception.name;
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = exception.message || "Internal server error";
    } else {
      this.logger.error("Unknown exception thrown", JSON.stringify(exception));
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }
}
