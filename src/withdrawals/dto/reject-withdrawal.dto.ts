import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectWithdrawalDto {
  @ApiProperty({
    example: 'Invalid crypto wallet address format',
    description: 'Reason for rejecting withdrawal request',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
