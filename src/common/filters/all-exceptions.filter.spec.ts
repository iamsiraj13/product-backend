import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockHttpAdapter: {
    getRequestUrl: jest.Mock;
    getRequestMethod: jest.Mock;
    reply: jest.Mock;
  };
  let mockHttpAdapterHost: HttpAdapterHost;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    mockHttpAdapter = {
      getRequestUrl: jest.fn().mockReturnValue('/api/test'),
      getRequestMethod: jest.fn().mockReturnValue('GET'),
      reply: jest.fn(),
    };

    mockHttpAdapterHost = {
      httpAdapter: mockHttpAdapter as any,
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
      }),
    } as any;

    filter = new AllExceptionsFilter(mockHttpAdapterHost);
  });

  it('should handle standard HttpException correctly', () => {
    const exception = new HttpException('Forbidden Resource', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden Resource',
        errorName: 'HttpException',
        path: '/api/test',
        method: 'GET',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it('should handle Prisma P2002 (Unique Constraint) error correctly', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['email'] },
      },
    );

    filter.catch(prismaError, mockArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with this email already exists.',
        errorName: 'PrismaError[P2002]',
      }),
      HttpStatus.CONFLICT,
    );
  });

  it('should handle Prisma P2025 (Not Found) error correctly', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
      meta: { cause: 'User record to delete does not exist.' },
    });

    filter.catch(prismaError, mockArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        message: 'User record to delete does not exist.',
        errorName: 'PrismaError[P2025]',
      }),
      HttpStatus.NOT_FOUND,
    );
  });

  it('should handle unknown unexpected errors with HTTP 500', () => {
    const genericError = new Error('Database disk full');

    filter.catch(genericError, mockArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorName: 'Error',
      }),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});
