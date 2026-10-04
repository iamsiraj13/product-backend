import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoNetwork, TransactionType } from '@prisma/client';
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

  async claimWelcomeReward(userId: string) {
    const REWARD_AMOUNT = 10.00;

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.hasClaimedWelcomeReward) {
        throw new BadRequestException('You have already claimed your $10 welcome reward');
      }

      const balanceBefore = Number(user.balance);
      const balanceAfter = balanceBefore + REWARD_AMOUNT;

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: REWARD_AMOUNT },
          hasClaimedWelcomeReward: true,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.CREDIT,
          amount: REWARD_AMOUNT,
          balanceBefore,
          balanceAfter,
          referenceType: 'WELCOME_REWARD',
          note: 'Free $10 sign-up bonus reward',
        },
      });

      return {
        message: 'Welcome reward of $10 claimed successfully!',
        newBalance: Number(updatedUser.balance),
        hasClaimedWelcomeReward: true,
      };
    });
  }
}

