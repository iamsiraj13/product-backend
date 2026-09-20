import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TaskStatus, TransactionType, Prisma } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prismaService: any;

  const mockUser = {
    id: 'usr-1',
    username: 'john_doe',
    balance: new Prisma.Decimal('100.00'),
    isActive: true,
  };

  const mockProduct = {
    id: 'prod-1',
    title: 'Test Earbuds',
    price: new Prisma.Decimal('50.00'),
    commissionRate: new Prisma.Decimal('10.00'),
    isActive: true,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      productTask: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTask', () => {
    it('should throw BadRequestException when user hits 33 daily tasks limit', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.productTask.count.mockResolvedValue(33);

      await expect(service.generateTask('usr-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if user already has an active pending task', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.productTask.count.mockResolvedValue(5);
      prismaService.productTask.findFirst.mockResolvedValue({
        id: 'existing-task',
        status: TaskStatus.PENDING,
      });

      await expect(service.generateTask('usr-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if no products match user current balance', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        balance: new Prisma.Decimal('5.00'),
      });
      prismaService.productTask.count.mockResolvedValue(0);
      prismaService.productTask.findFirst.mockResolvedValue(null);
      prismaService.product.findMany.mockResolvedValue([]);

      await expect(service.generateTask('usr-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should randomly assign product and create task snapshot when eligible', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.productTask.count.mockResolvedValue(2);
      prismaService.productTask.findFirst.mockResolvedValue(null);
      prismaService.product.findMany.mockResolvedValue([mockProduct]);

      const createdTask = {
        id: 'task-new',
        userId: 'usr-1',
        productId: mockProduct.id,
        priceSnapshot: mockProduct.price,
        commissionSnapshot: mockProduct.commissionRate,
        status: TaskStatus.GENERATED,
        product: mockProduct,
      };

      prismaService.productTask.create.mockResolvedValue(createdTask);

      const result = await service.generateTask('usr-1');

      expect(result).toEqual(createdTask);
      expect(prismaService.productTask.create).toHaveBeenCalledWith({
        data: {
          userId: 'usr-1',
          productId: mockProduct.id,
          stepNumber: 3,
          priceSnapshot: mockProduct.price,
          commissionSnapshot: mockProduct.commissionRate,
          status: TaskStatus.GENERATED,
        },
        include: { product: true },
      });
    });

    it('should return existing pre-generated task with overridden price and commission snapshot if present', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.productTask.count.mockResolvedValue(0);

      const overriddenTask = {
        id: 'task-overridden-1',
        userId: 'usr-1',
        productId: mockProduct.id,
        stepNumber: 1,
        priceSnapshot: new Prisma.Decimal('250.00'),
        commissionSnapshot: new Prisma.Decimal('15.00'),
        status: TaskStatus.GENERATED,
        product: mockProduct,
      };

      prismaService.productTask.findFirst
        .mockResolvedValueOnce(null) // no active IN_PROGRESS task
        .mockResolvedValueOnce(overriddenTask); // step 1 pre-generated/overridden task

      const result = await service.generateTask('usr-1');

      expect(result).toEqual(overriddenTask);
      expect(prismaService.productTask.create).not.toHaveBeenCalled();
    });
  });

  describe('startTask', () => {
    it('should debit user balance and update status to IN_PROGRESS even if price exceeds balance', async () => {
      const taskGenerated = {
        id: 'task-overridden-1',
        userId: 'usr-1',
        priceSnapshot: new Prisma.Decimal('250.00'),
        commissionSnapshot: new Prisma.Decimal('15.00'),
        status: TaskStatus.GENERATED,
      };

      prismaService.productTask.findUnique.mockResolvedValue(taskGenerated);
      prismaService.user.findUnique.mockResolvedValue(mockUser); // balance: 100.00
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        balance: new Prisma.Decimal('-150.00'),
      });
      prismaService.productTask.update.mockResolvedValue({
        ...taskGenerated,
        status: TaskStatus.PENDING,
      });

      const result = await service.startTask('usr-1', 'task-overridden-1');

      expect(result.updatedBalance.toString()).toBe('-150');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: { balance: new Prisma.Decimal('-150.00') },
      });
      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr-1',
          type: TransactionType.DEBIT,
          amount: new Prisma.Decimal('250.00'),
          balanceBefore: new Prisma.Decimal('100.00'),
          balanceAfter: new Prisma.Decimal('-150.00'),
          referenceType: 'TASK_START',
        }),
      });
    });
  });

  describe('submitTask', () => {
    it('should refund product price and credit earned commission in transaction for IN_PROGRESS task', async () => {
      const taskInProg = {
        id: 'task-100',
        userId: 'usr-1',
        priceSnapshot: new Prisma.Decimal('50.00'),
        commissionSnapshot: new Prisma.Decimal('10.00'), // 10% commission = $5.00
        status: TaskStatus.IN_PROGRESS,
      };

      prismaService.productTask.findUnique.mockResolvedValue(taskInProg);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        balance: new Prisma.Decimal('155.00'),
      });

      const completedTask = {
        ...taskInProg,
        status: TaskStatus.COMPLETED,
        earnedCommission: new Prisma.Decimal('5.00'),
      };
      prismaService.productTask.update.mockResolvedValue(completedTask);

      const result = await service.submitTask('usr-1', 'task-100', {
        rating: 5,
        comment: 'Great product quality!',
      });

      expect(result.message).toBe('Real transaction completed');
      expect(result.earnedCommission.toString()).toBe('5');
      expect(result.updatedBalance.toString()).toBe('155'); // $100 + $50 price + $5 commission
      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr-1',
          type: TransactionType.CREDIT,
          amount: new Prisma.Decimal('55.00'),
          referenceType: 'TASK_COMPLETE',
        }),
      });
    });

    it('should auto-start task if status is GENERATED and then submit', async () => {
      const taskGenerated = {
        id: 'task-gen-100',
        userId: 'usr-1',
        priceSnapshot: new Prisma.Decimal('50.00'),
        commissionSnapshot: new Prisma.Decimal('10.00'),
        status: TaskStatus.GENERATED,
      };

      const taskInProg = {
        ...taskGenerated,
        status: TaskStatus.PENDING,
      };

      const taskCompleted = {
        ...taskInProg,
        status: TaskStatus.COMPLETED,
        earnedCommission: new Prisma.Decimal('5.00'),
      };

      prismaService.productTask.findUnique.mockResolvedValue(taskGenerated);
      prismaService.user.findUnique.mockResolvedValue(mockUser); // balance: 100.00
      prismaService.productTask.update
        .mockResolvedValueOnce(taskInProg)
        .mockResolvedValueOnce(taskCompleted);

      const result = await service.submitTask('usr-1', 'task-gen-100', {
        rating: 5,
      });

      expect(result.message).toBe('Real transaction completed');
      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr-1',
          type: TransactionType.DEBIT,
          amount: new Prisma.Decimal('50.00'),
          referenceType: 'TASK_START',
        }),
      });
      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr-1',
          type: TransactionType.CREDIT,
          amount: new Prisma.Decimal('55.00'),
          referenceType: 'TASK_COMPLETE',
        }),
      });
    });

    it('should throw BadRequestException if task is already COMPLETED', async () => {
      const taskCompleted = {
        id: 'task-100',
        userId: 'usr-1',
        priceSnapshot: new Prisma.Decimal('50.00'),
        commissionSnapshot: new Prisma.Decimal('10.00'),
        status: TaskStatus.COMPLETED,
      };

      prismaService.productTask.findUnique.mockResolvedValue(taskCompleted);

      await expect(
        service.submitTask('usr-1', 'task-100', { rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPendingTask', () => {
    it('should return pending task if active GENERATED or IN_PROGRESS task exists', async () => {
      const pendingTask = {
        id: 'task-pending-1',
        userId: 'usr-1',
        status: TaskStatus.IN_PROGRESS,
        product: mockProduct,
      };

      prismaService.productTask.findFirst.mockResolvedValue(pendingTask);

      const result = await service.getPendingTask('usr-1');

      expect(result).toEqual(pendingTask);
      expect(prismaService.productTask.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'usr-1',
          status: {
            in: [TaskStatus.PENDING],
          },
        },
        include: {
          product: true,
        },
        orderBy: { generatedAt: 'desc' },
      });
    });

    it('should return null if no pending task exists', async () => {
      prismaService.productTask.findFirst.mockResolvedValue(null);

      const result = await service.getPendingTask('usr-1');

      expect(result).toBeNull();
    });
  });
});

