import { HttpException, HttpStatus } from '@nestjs/common';

export class ResourceNotFoundException extends HttpException {
  constructor(resource = 'Resource', id?: string | number) {
    const message = id ? `${resource} with ID '${id}' was not found.` : `${resource} was not found.`;
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ResourceAlreadyExistsException extends HttpException {
  constructor(resource = 'Resource', field = 'identifier') {
    super(`${resource} with this ${field} already exists.`, HttpStatus.CONFLICT);
  }
}

export class InsufficientBalanceException extends HttpException {
  constructor(message = 'Insufficient balance to complete transaction.') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
