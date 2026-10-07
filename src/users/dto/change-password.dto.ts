import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'oldPassword123',
    description: 'Current account login password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  oldPassword: string;

  @ApiProperty({
    example: 'newPassword123',
    description: 'New account login password (minimum 6 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  newPassword: string;

  @ApiPropertyOptional({
    example: 'newPassword123',
    description: 'Confirm new account login password',
  })
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
