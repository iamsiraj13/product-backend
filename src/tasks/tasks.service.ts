import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TransactionType, Prisma } from '@prisma/client';
import { SubmitTaskDto } from './dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // Generate a new random product task for the user
  async generateTask(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException('User is inactive or not found');
    }

    // 1. Check daily limit (33 tasks per day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const generatedTodayCount = await this.prisma.productTask.count({
      where: {
        userId,
        generatedAt: {
          gte: startOfDay,
        },
        status: {
          in: [TaskStatus.GENERATED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED],
        },
      },
    });

    const DAILY_LIMIT = 33;
    if (generatedTodayCount >= DAILY_LIMIT) {
      throw new BadRequestException(
        `Daily task limit of ${DAILY_LIMIT} tasks has been reached for today`,
      );
    }

    // 2. Check if user already has an uncompleted task (GENERATED or IN_PROGRESS)
    const activeTask = await this.prisma.productTask.findFirst({
      where: {
        userId,
        status: {
          in: [TaskStatus.GENERATED, TaskStatus.IN_PROGRESS],
        },
      },
      include: {
        product: true,
      },
    });

    if (activeTask) {
      throw new ConflictException(
        'You have an active pending task. Please complete or process it before generating a new one.',
      );
    }

    // 3. Filter active products where price <= currentBalance
    const eligibleProducts = await this.prisma.product.findMany({
      where: {
        isActive: true,
        price: {
          lte: user.balance,
        },
      },
    });

    if (eligibleProducts.length === 0) {
      throw new BadRequestException(
        'Insufficient balance to generate tasks. Your current balance does not meet the minimum price of available active products.',
      );
    }

    // 4. Randomly pick an eligible product
    const randomIndex = Math.floor(Math.random() * eligibleProducts.length);
    const selectedProduct = eligibleProducts[randomIndex];

    // 5. Create ProductTask snapshot
    const newTask = await this.prisma.productTask.create({
      data: {
        userId,
        productId: selectedProduct.id,
        priceSnapshot: selectedProduct.price,
        commissionSnapshot: selectedProduct.commissionRate,
        status: TaskStatus.GENERATED,
      },
      include: {
        product: true,
      },
    });

    return newTask;
  }

  // Start task: Lock task and debit user balance
  async startTask(userId: string, taskId: string) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.productTask.findUnique({
        where: { id: taskId },
        include: { product: true },
      });

      if (!task || task.userId !== userId) {
        throw new NotFoundException('Task not found');
      }

      if (task.status !== TaskStatus.GENERATED) {
        throw new BadRequestException(
          `Task cannot be started because its current status is ${task.status}`,
        );
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new BadRequestException('User inactive or invalid');
      }

      const balanceBefore = new Prisma.Decimal(user.balance.toString());
      const priceToDebit = new Prisma.Decimal(task.priceSnapshot.toString());

      if (balanceBefore.lessThan(priceToDebit)) {
        throw new BadRequestException(
          `Insufficient wallet balance to start task. Required: $${priceToDebit}, Available: $${balanceBefore}`,
        );
      }

      const balanceAfter = balanceBefore.sub(priceToDebit);

      // Debit User Balance
      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      // Update Task status to IN_PROGRESS
      const updatedTask = await tx.productTask.update({
        where: { id: taskId },
        data: { status: TaskStatus.IN_PROGRESS },
        include: { product: true },
      });

      // Record Audit Transaction Log
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.DEBIT,
          amount: priceToDebit,
          balanceBefore,
          balanceAfter,
          referenceType: 'TASK_START',
          referenceId: taskId,
          note: `Started product task #${taskId.substring(0, 8)} - debited snapshot price`,
        },
      });

      return {
        task: updatedTask,
        updatedBalance: balanceAfter,
      };
    });
  }

  // Submit task review: Refund product price + credit earned commission
  async submitTask(userId: string, taskId: string, dto: SubmitTaskDto) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.productTask.findUnique({
        where: { id: taskId },
        include: { product: true },
      });

      if (!task || task.userId !== userId) {
        throw new NotFoundException('Task not found');
      }

      if (task.status !== TaskStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Task cannot be submitted because its current status is ${task.status}`,
        );
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const priceSnapshot = new Prisma.Decimal(task.priceSnapshot.toString());
      const commissionRate = new Prisma.Decimal(task.commissionSnapshot.toString());
      
      // earnedCommission = priceSnapshot * (commissionRate / 100)
      const earnedCommission = priceSnapshot.mul(commissionRate).div(100);
      const totalCreditAmount = priceSnapshot.add(earnedCommission);

      const balanceBefore = new Prisma.Decimal(user.balance.toString());
      const balanceAfter = balanceBefore.add(totalCreditAmount);

      // Credit balance
      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      // Update Task status to COMPLETED
      const completedTask = await tx.productTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          earnedCommission,
          rating: dto.rating,
          comment: dto.comment || null,
          completedAt: new Date(),
        },
        include: { product: true },
      });

      // Log Transaction
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.CREDIT,
          amount: totalCreditAmount,
          balanceBefore,
          balanceAfter,
          referenceType: 'TASK_COMPLETE',
          referenceId: taskId,
          note: `Completed product task #${taskId.substring(0, 8)} - refunded price ($${priceSnapshot}) + commission ($${earnedCommission})`,
        },
      });

      return {
        task: completedTask,
        earnedCommission,
        updatedBalance: balanceAfter,
      };
    });
  }

  // Get user task history and active task status
  async getUserTasks(userId: string) {
    const activeTask = await this.prisma.productTask.findFirst({
      where: {
        userId,
        status: {
          in: [TaskStatus.GENERATED, TaskStatus.IN_PROGRESS],
        },
      },
      include: {
        product: true,
      },
      orderBy: { generatedAt: 'desc' },
    });

    const recentCompleted = await this.prisma.productTask.findMany({
      where: {
        userId,
        status: TaskStatus.COMPLETED,
      },
      include: {
        product: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    return {
      activeTask,
      recentCompleted,
    };
  }
}
