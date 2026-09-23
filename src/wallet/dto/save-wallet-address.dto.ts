import { ApiProperty } from '@nestjs/swagger';
import { CryptoNetwork } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class SaveWalletAddressDto {
  @ApiProperty({
    enum: CryptoNetwork,
    example: CryptoNetwork.TRC20,
    description: 'Crypto network type (TRC20, ERC20, BTC)',
  })
  @IsEnum(CryptoNetwork)
  @IsNotEmpty()
  network: CryptoNetwork;

  @ApiProperty({
    example: 'T9x1234567890123456789012345678901',
    description: 'Crypto wallet address for the network',
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}
