import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeWithdrawalPasswordDto {
  @ApiPropertyOptional({
    example: '123456',
    description: 'Current withdrawal password (required if withdrawal password is already set)',
  })
  @IsOptional()
  @IsString()
  oldWithdrawalPassword?: string;

  @ApiProperty({
    example: '654321',
    description: 'New withdrawal password (minimum 4 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New withdrawal password is required' })
  @MinLength(4, { message: 'New withdrawal password must be at least 4 characters long' })
  newWithdrawalPassword: string;

  @ApiPropertyOptional({
    example: '654321',
    description: 'Confirm new withdrawal password',
  })
  @IsOptional()
  @IsString()
  confirmWithdrawalPassword?: string;
}
