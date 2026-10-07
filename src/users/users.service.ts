import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { formatImageUrl } from '../common/utils/url.util';
import { TaskStatus } from '@prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeWithdrawalPasswordDto } from './dto/change-withdrawal-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) { }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        accountType: true,
        balance: true,
        taskLimit: true,
        invitationCode: true,
        hasClaimedWelcomeReward: true,
        parentUserId: true,
        parentUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        childAccounts: {
          select: {
            id: true,
            username: true,
            accountType: true,
            balance: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            invitees: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const taskLimit = user.taskLimit || 33;

    // Calculate total completed tasks
    const totalCompletedCount = await this.prisma.productTask.count({
      where: {
        userId,
        status: TaskStatus.COMPLETED,
      },
    });

    const completedInCurrentCycle = totalCompletedCount % taskLimit;
    const currentCycle = Math.floor(totalCompletedCount / taskLimit) + 1;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Calculate commission statistics
    const totalCommissionAggregate = await this.prisma.productTask.aggregate({
      where: {
        userId,
        status: TaskStatus.COMPLETED,
      },
      _sum: {
        earnedCommission: true,
      },
      _count: {
        id: true,
      },
    });

    const todayCommissionAggregate = await this.prisma.productTask.aggregate({
      where: {
        userId,
        status: TaskStatus.COMPLETED,
        completedAt: {
          gte: startOfDay,
        },
      },
      _sum: {
        earnedCommission: true,
      },
    });

    const totalEarnedCommission = Number(
      totalCommissionAggregate._sum.earnedCommission || 0,
    );
    const todayEarnedCommission = Number(
      todayCommissionAggregate._sum.earnedCommission || 0,
    );

    return {
      ...user,
      avatar: formatImageUrl(user.avatar),
      taskProgress: {
        completedInCurrentCycle,
        taskLimit,
        currentCycle,
        remainingInCycle: Math.max(0, taskLimit - completedInCurrentCycle),
        totalCompletedCount,
      },
      todayTaskProgress: {
        totalGeneratedToday: completedInCurrentCycle,
        completedToday: completedInCurrentCycle,
        dailyLimit: taskLimit,
        remainingToday: Math.max(0, taskLimit - completedInCurrentCycle),
      },
      commissionSummary: {
        totalEarned: totalEarnedCommission,
        todayEarned: todayEarnedCommission,
      },
    };
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Avatar image file is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const avatarUrl = await this.storageService.uploadFile(file, 'users');

    // Delete old avatar if exists
    if (user.avatar) {
      await this.storageService.deleteFile(user.avatar);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
      },
    });

    return {
      ...updatedUser,
      avatar: formatImageUrl(updatedUser.avatar),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password matches confirmPassword if provided
    if (dto.confirmPassword && dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    // Check if new password is same as old password
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash new password and save
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async changeWithdrawalPassword(userId: string, dto: ChangeWithdrawalPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // If withdrawal password is already set, verify current withdrawal password
    if (user.withdrawalPasswordHash) {
      if (!dto.oldWithdrawalPassword) {
        throw new BadRequestException('Current withdrawal password is required');
      }

      const isWithdrawalPasswordValid = await bcrypt.compare(
        dto.oldWithdrawalPassword,
        user.withdrawalPasswordHash,
      );

      if (!isWithdrawalPasswordValid) {
        throw new BadRequestException('Current withdrawal password is incorrect');
      }

      if (dto.oldWithdrawalPassword === dto.newWithdrawalPassword) {
        throw new BadRequestException('New withdrawal password must be different from current withdrawal password');
      }
    }

    // Check if confirm withdrawal password matches if provided
    if (dto.confirmWithdrawalPassword && dto.newWithdrawalPassword !== dto.confirmWithdrawalPassword) {
      throw new BadRequestException('New withdrawal password and confirm withdrawal password do not match');
    }

    // Hash new withdrawal password and save
    const withdrawalPasswordHash = await bcrypt.hash(dto.newWithdrawalPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { withdrawalPasswordHash },
    });

    return {
      message: 'Withdrawal password updated successfully',
    };
  }
}

