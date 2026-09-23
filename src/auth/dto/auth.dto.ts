import { IsNotEmpty, IsOptional, IsString, IsEmail, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'johndoe', description: 'Unique username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({ example: '123456', description: 'Withdrawal password for security verification' })
  @IsString()
  @IsNotEmpty({ message: 'Withdrawal password is required' })
  @MinLength(4, { message: 'Withdrawal password must be at least 4 characters long' })
  withdrawalPassword: string;

  @ApiPropertyOptional({ example: 'john@example.com', description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'INVITE123', description: 'Mandatory invitation code' })
  @IsString()
  @IsNotEmpty({ message: 'Invitation code is mandatory for registration' })
  invitationCode: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
