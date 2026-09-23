import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType, WithdrawalStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { WithdrawalQueryDto } from './dto/withdrawal-query.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) { }

  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('User account is disabled');
    }

    // Verify withdrawal password
    if (!user.withdrawalPasswordHash) {
      throw new BadRequestException('Withdrawal password is not set for this account');
    }

    const isWithdrawalPasswordValid = await bcrypt.compare(
      dto.withdrawalPassword,
      user.withdrawalPasswordHash,
    );

    if (!isWithdrawalPasswordValid) {
      throw new BadRequestException('Invalid withdrawal password');
    }

    // Check if user has saved a wallet address for the requested network
    const walletAddress = await this.prisma.walletAddress.findUnique({
      where: {
        userId_network: {
          userId,
          network: dto.network,
        },
      },
    });

    if (!walletAddress) {
      throw new BadRequestException(
        `No wallet address saved for network ${dto.network}. Please bind your wallet address in Wallet settings first.`,
      );
    }

    const currentBalance = new Prisma.Decimal(user.balance);
    const requestedAmount = new Prisma.Decimal(dto.amount);

    if (currentBalance.lessThan(requestedAmount)) {
      throw new BadRequestException(
        `Insufficient balance. Available: $${currentBalance.toFixed(2)}, Requested: $${requestedAmount.toFixed(2)}`,
      );
    }

    // Execute atomic transaction: deduct balance, log transaction, create withdrawal request
    const result = await this.prisma.$transaction(async (tx) => {
      const balanceBefore = currentBalance;
      const balanceAfter = balanceBefore.minus(requestedAmount);

      // 1. Deduct user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: balanceAfter,
        },
      });

      // 2. Create withdrawal request
      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId,
          network: dto.network,
          walletAddress: walletAddress.address,
          amount: requestedAmount,
          status: WithdrawalStatus.PENDING,
        },
      });

      // 3. Log transaction ledger entry
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.DEBIT,
          amount: requestedAmount,
          balanceBefore,
          balanceAfter,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal.id,
          note: `Withdrawal request of $${requestedAmount.toFixed(2)} to ${dto.network} wallet (${walletAddress.address})`,
        },
      });

      return withdrawal;
    });

    return {
      message: 'Withdrawal request submitted successfully',
      data: result,
    };
  }

  async getUserWithdrawalHistory(userId: string, query: WithdrawalQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.WithdrawalRequestWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllWithdrawalsForAdmin(query: WithdrawalQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.WithdrawalRequestWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        user: {
          OR: [
            { username: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveWithdrawal(withdrawalId: string, adminId: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve withdrawal with status ${withdrawal.status}. Only PENDING requests can be approved.`,
      );
    }

    const updated = await this.prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.APPROVED,
        processedAt: new Date(),
        processedById: adminId,
      },
    });

    return {
      message: 'Withdrawal request approved successfully',
      data: updated,
    };
  }

  async rejectWithdrawal(
    withdrawalId: string,
    adminId: string,
    dto: RejectWithdrawalDto,
  ) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject withdrawal with status ${withdrawal.status}. Only PENDING requests can be rejected.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: withdrawal.userId },
      });

      if (!user) {
        throw new NotFoundException('User for this withdrawal request not found');
      }

      const refundAmount = new Prisma.Decimal(withdrawal.amount);
      const balanceBefore = new Prisma.Decimal(user.balance);
      const balanceAfter = balanceBefore.plus(refundAmount);

      // 1. Update withdrawal status to REJECTED
      const updatedWithdrawal = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.REJECTED,
          rejectionReason: dto.reason,
          processedAt: new Date(),
          processedById: adminId,
        },
      });

      // 2. Refund balance to user
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          balance: balanceAfter,
        },
      });

      // 3. Log transaction refund
      await tx.transaction.create({
        data: {
          userId: withdrawal.userId,
          type: TransactionType.CREDIT,
          amount: refundAmount,
          balanceBefore,
          balanceAfter,
          referenceType: 'WITHDRAWAL_REFUND',
          referenceId: withdrawalId,
          note: `Refund for rejected withdrawal request #${withdrawalId}. Reason: ${dto.reason}`,
        },
      });

      return updatedWithdrawal;
    });

    return {
      message: 'Withdrawal request rejected and balance refunded successfully',
      data: result,
    };
  }

  async updateWithdrawalStatus(
    withdrawalId: string,
    adminId: string,
    dto: UpdateWithdrawalStatusDto,
  ) {
    if (dto.status === WithdrawalStatus.APPROVED) {
      return this.approveWithdrawal(withdrawalId, adminId);
    } else if (dto.status === WithdrawalStatus.REJECTED) {
      if (!dto.rejectionReason) {
        throw new BadRequestException('Rejection reason is required when status is REJECTED');
      }
      return this.rejectWithdrawal(withdrawalId, adminId, { reason: dto.rejectionReason });
    } else {
      throw new BadRequestException('Invalid status. Only APPROVED or REJECTED are allowed.');
    }
  }
}
