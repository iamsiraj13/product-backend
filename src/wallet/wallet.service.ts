import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoNetwork } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveWalletAddressDto } from './dto/save-wallet-address.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private validateAddressFormat(network: CryptoNetwork, address: string): void {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      throw new BadRequestException('Wallet address cannot be empty');
    }
  }

  async getUserWalletAddresses(userId: string) {
    const addresses = await this.prisma.walletAddress.findMany({
      where: { userId },
      select: {
        id: true,
        network: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return addresses;
  }

  async saveWalletAddress(userId: string, dto: SaveWalletAddressDto) {
    this.validateAddressFormat(dto.network, dto.address);

    const savedAddress = await this.prisma.walletAddress.upsert({
      where: {
        userId_network: {
          userId,
          network: dto.network,
        },
      },
      update: {
        address: dto.address.trim(),
      },
      create: {
        userId,
        network: dto.network,
        address: dto.address.trim(),
      },
    });

    return {
      message: `${dto.network} wallet address saved successfully`,
      data: savedAddress,
    };
  }
}
