import { ApiPropertyOptional } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class WithdrawalQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: WithdrawalStatus })
  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;

  @ApiPropertyOptional({ description: 'Search term for username or email (Admin only)' })
  @IsOptional()
  @IsString()
  search?: string;
}
