import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { formatImageUrl } from '../common/utils/url.util';
import { TaskStatus } from '@prisma/client';

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

    // Calculate today's task progress
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayTaskCount = await this.prisma.productTask.count({
      where: {
        userId,
        generatedAt: {
          gte: startOfDay,
        },
        status: {
          in: [TaskStatus.GENERATED, TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED],
        },
      },
    });

    const completedTasksToday = await this.prisma.productTask.count({
      where: {
        userId,
        generatedAt: {
          gte: startOfDay,
        },
        status: TaskStatus.COMPLETED,
      },
    });

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
    const totalCommissionCount = totalCommissionAggregate._count.id;

    const DAILY_LIMIT = 33;

    return {
      ...user,
      avatar: formatImageUrl(user.avatar),
      todayTaskProgress: {
        totalGeneratedToday: todayTaskCount,
        completedToday: completedTasksToday,
        dailyLimit: DAILY_LIMIT,
        remainingToday: Math.max(0, DAILY_LIMIT - todayTaskCount),
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
}

