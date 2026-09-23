import { ApiProperty } from '@nestjs/swagger';
import { CryptoNetwork } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 100.0, description: 'Amount to withdraw' })
  @IsNumber()
  @IsPositive()
  @Min(1, { message: 'Minimum withdrawal amount is 1.00' })
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    enum: CryptoNetwork,
    example: CryptoNetwork.TRC20,
    description: 'Target crypto network for withdrawal',
  })
  @IsEnum(CryptoNetwork)
  @IsNotEmpty()
  network: CryptoNetwork;

  @ApiProperty({
    example: '123456',
    description: 'Withdrawal password for security verification',
  })
  @IsNotEmpty({ message: 'Withdrawal password is required' })
  withdrawalPassword: string;
}
