import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateWithdrawalStatusDto {
  @ApiProperty({
    enum: WithdrawalStatus,
    example: WithdrawalStatus.APPROVED,
    description: 'Target status for withdrawal request (APPROVED or REJECTED)',
  })
  @IsEnum(WithdrawalStatus, {
    message: 'Status must be either APPROVED or REJECTED',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: WithdrawalStatus;

  @ApiPropertyOptional({
    example: 'Invalid wallet address provided',
    description: 'Reason for rejection (Required if status is REJECTED)',
  })
  @ValidateIf((o) => o.status === WithdrawalStatus.REJECTED)
  @IsNotEmpty({ message: 'Rejection reason is required when status is REJECTED' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
