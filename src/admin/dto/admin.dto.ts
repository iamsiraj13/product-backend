import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  IsEmail,
  MinLength,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, AccountType, TransactionType } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Headphones', description: 'Product title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Product image file upload (or image URL string)',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ example: 99.99, description: 'Product price' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiPropertyOptional({ example: 2.0, default: 2.0, description: 'Commission percentage rate (default 2%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiPropertyOptional({ example: 4.0, description: 'Commission dollar amount (calculated automatically if omitted)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commission?: number;

  @ApiPropertyOptional({ example: false, description: 'Whether featured on home page' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isHomeProduct?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Whether product is active' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Updated Product Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Updated product image file upload (or image URL string)',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 149.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price?: number;

  @ApiPropertyOptional({ example: 12.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiPropertyOptional({ example: 3.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commission?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isHomeProduct?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class AdjustBalanceDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.CREDIT, description: 'Adjustment type: CREDIT or DEBIT' })
  @IsEnum(TransactionType, { message: 'Type must be CREDIT or DEBIT' })
  type: TransactionType;

  @ApiProperty({ example: 50.0, description: 'Balance adjustment amount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Adjustment amount must be greater than 0' })
  amount: number;

  @ApiProperty({ example: 'Bonus credit top-up', description: 'Mandatory note explaining adjustment' })
  @IsString()
  @IsNotEmpty({ message: 'A mandatory note is required for financial adjustments' })
  note: string;
}

export class CreateAgentDto {
  @ApiProperty({ example: 'agent_smith', description: 'Agent username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'agentPass123', description: 'Agent password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'agent@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1987654321' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateTrainingAccountDto {
  @ApiProperty({ example: 'trainee_john', description: 'Training account username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'trainPass123', description: 'Training account password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'trainee@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1555000111' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 100.0, description: 'Initial balance for training account' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialBalance?: number;
}

export class UserQueryDto {
  @ApiPropertyOptional({ description: 'Search filter by username/email/phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Role, description: 'Filter by user role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: AccountType, description: 'Filter by account type' })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class ProductQueryDto {
  @ApiPropertyOptional({ description: 'Search filter by product title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by home page feature status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isHomeProduct?: boolean;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number (default 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Items per page (default 10)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

