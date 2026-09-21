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
  constructor(private readonly prisma: PrismaService) { }

  // Generate a new product task for the user
  async generateTask(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException('User is inactive or not found');
    }

    const taskLimit = user.taskLimit || 33;

    // 1. Check user completed task limit for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const completedTodayCount = await this.prisma.productTask.count({
      where: {
        userId,
        status: TaskStatus.COMPLETED,
        completedAt: {
          gte: startOfDay,
        },
      },
    });

    if (completedTodayCount >= taskLimit) {
      throw new BadRequestException(
        `Task limit of ${taskLimit} tasks has been reached`,
      );
    }

    // 2. Check if user already has an active task in progress or pending
    const activeTask = await this.prisma.productTask.findFirst({
      where: {
        userId,
        status: {
          in: [TaskStatus.PENDING],
        },
      },
      include: {
        product: true,
      },
    });

    if (activeTask) {
      throw new ConflictException(
        'You have an active pending task. Please complete it before generating a new one.',
      );
    }

    // 3. Count total completed tasks to determine current next step number
    const totalCompletedCount = await this.prisma.productTask.count({
      where: {
        userId,
        status: TaskStatus.COMPLETED,
      },
    });

    const nextStepNumber = totalCompletedCount + 1;

    // 4. Check for existing pre-generated / allocated task slot for the next step number
    const existingTask = await this.prisma.productTask.findFirst({
      where: {
        userId,
        stepNumber: nextStepNumber,
        status: TaskStatus.GENERATED,
      },
      include: {
        product: true,
      },
    });

    if (existingTask) {
      return existingTask;
    }

    // 5. Filter active products where price <= currentBalance
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

    // 6. Randomly pick an eligible product
    const randomIndex = Math.floor(Math.random() * eligibleProducts.length);
    const selectedProduct = eligibleProducts[randomIndex];

    // 7. Create ProductTask snapshot with stepNumber
    const newTask = await this.prisma.productTask.create({
      data: {
        userId,
        productId: selectedProduct.id,
        stepNumber: nextStepNumber,
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

      // if (balanceBefore.lt(priceToDebit)) {
      //   throw new BadRequestException(
      //     `Insufficient balance to start task. Your current balance ($${balanceBefore}) is less than the required task price ($${priceToDebit}). Please deposit funds.`,
      //   );
      // }

      const balanceAfter = balanceBefore.sub(priceToDebit);

      // Debit User Balance
      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      // Update Task status to PENDING
      const updatedTask = await tx.productTask.update({
        where: { id: taskId },
        data: { status: TaskStatus.PENDING },
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
      let task = await tx.productTask.findUnique({
        where: { id: taskId },
        include: { product: true },
      });

      if (!task || task.userId !== userId) {
        throw new NotFoundException('Task not found');
      }

      if (task.status === TaskStatus.COMPLETED) {
        throw new BadRequestException('Task has already been completed');
      }

      let user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const priceSnapshot = new Prisma.Decimal(task.priceSnapshot.toString());
      const userBalance = new Prisma.Decimal(user.balance.toString());

      // Calculate effective balance:
      // If task is GENERATED, balance has not been debited yet (effectiveBalance = userBalance).
      // If task is PENDING, priceSnapshot was already debited when started (effectiveBalance = userBalance + priceSnapshot).
      const effectiveBalance =
        task.status === TaskStatus.GENERATED
          ? userBalance
          : userBalance.add(priceSnapshot);

      if (effectiveBalance.lt(priceSnapshot)) {
        throw new BadRequestException(
          `Insufficient balance to submit task. Your current balance ($${effectiveBalance}) is less than the required task price ($${priceSnapshot}). Please deposit funds.`,
        );
      }

      // If task is in GENERATED state (not yet started), auto-start it first to debit priceSnapshot
      if (task.status === TaskStatus.GENERATED) {
        if (!user.isActive) {
          throw new BadRequestException('User inactive or invalid');
        }

        const startBalanceBefore = userBalance;
        const priceToDebit = priceSnapshot;
        const startBalanceAfter = startBalanceBefore.sub(priceToDebit);

        // Debit User Balance for task start
        await tx.user.update({
          where: { id: userId },
          data: { balance: startBalanceAfter },
        });

        // Update status to PENDING
        task = await tx.productTask.update({
          where: { id: taskId },
          data: { status: TaskStatus.PENDING },
          include: { product: true },
        });

        // Log TASK_START transaction
        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.DEBIT,
            amount: priceToDebit,
            balanceBefore: startBalanceBefore,
            balanceAfter: startBalanceAfter,
            referenceType: 'TASK_START',
            referenceId: taskId,
            note: `Started product task #${taskId.substring(0, 8)} - debited snapshot price`,
          },
        });

        // Update user balance reference for completion step below
        user.balance = startBalanceAfter;
      }

      const balanceBefore = new Prisma.Decimal(user.balance.toString());
      const commissionRate = new Prisma.Decimal(task.commissionSnapshot.toString());

      // earnedCommission = priceSnapshot * (commissionRate / 100)
      const earnedCommission = priceSnapshot.mul(commissionRate).div(100);
      const totalCreditAmount = priceSnapshot.add(earnedCommission);

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
        message: 'Real transaction completed',
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
          in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
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

  // Get only pending task for the logged-in user
  async getPendingTask(userId: string) {
    const pendingTask = await this.prisma.productTask.findFirst({
      where: {
        userId,
        status: {
          in: [TaskStatus.PENDING],
        },
      },
      include: {
        product: true,
      },
      orderBy: { generatedAt: 'desc' },
    });

    return pendingTask;
  }
}

