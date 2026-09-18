import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

export interface ErrorResponseFormat {
  success: boolean;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  errorName?: string;
  errors?: any;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'InternalServerError';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      errorName = exception.name;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, any>;
        message = responseObj.message || exception.message;
        if (responseObj.errors) {
          errorDetails = responseObj.errors;
        } else if (Array.isArray(responseObj.message)) {
          errorDetails = responseObj.message;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      errorName = `PrismaError[${exception.code}]`;
      switch (exception.code) {
        case 'P2002': {
          httpStatus = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[]) || [];
          const fields = Array.isArray(target) ? target.join(', ') : String(target);
          message = fields
            ? `A record with this ${fields} already exists.`
            : 'Unique constraint failed.';
          break;
        }
        case 'P2025': {
          httpStatus = HttpStatus.NOT_FOUND;
          message = (exception.meta?.cause as string) || 'Requested record was not found.';
          break;
        }
        case 'P2003': {
          httpStatus = HttpStatus.BAD_REQUEST;
          const fieldName = (exception.meta?.field_name as string) || '';
          message = fieldName
            ? `Invalid reference provided for ${fieldName}.`
            : 'Foreign key constraint failed.';
          break;
        }
        case 'P2000': {
          httpStatus = HttpStatus.BAD_REQUEST;
          message = 'The provided value is too long for the field.';
          break;
        }
        case 'P2014': {
          httpStatus = HttpStatus.BAD_REQUEST;
          message = 'The change would violate a required relation.';
          break;
        }
        default: {
          httpStatus = HttpStatus.BAD_REQUEST;
          message = `Database operation failed (${exception.code}).`;
          break;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      httpStatus = HttpStatus.BAD_REQUEST;
      errorName = 'PrismaValidationError';
      message = 'Invalid data provided for database operation.';
    } else if (exception instanceof Error) {
      errorName = exception.name;
      message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : exception.message;
    }

    const responseBody: ErrorResponseFormat = {
      success: false,
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request),
      method: httpAdapter.getRequestMethod(request),
      message,
      errorName,
      ...(errorDetails ? { errors: errorDetails } : {}),
    };

    if (httpStatus >= 500) {
      this.logger.error(
        `[${responseBody.method}] ${responseBody.path} - Status: ${httpStatus} - Error: ${
          exception instanceof Error ? exception.message : JSON.stringify(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${responseBody.method}] ${responseBody.path} - Status: ${httpStatus} - Message: ${JSON.stringify(
          message,
        )}`,
      );
    }

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}
