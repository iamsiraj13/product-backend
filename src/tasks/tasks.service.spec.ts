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
        status: TaskStatus.GENERATED,
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
          priceSnapshot: mockProduct.price,
          commissionSnapshot: mockProduct.commissionRate,
          status: TaskStatus.GENERATED,
        },
        include: { product: true },
      });
    });
  });

  describe('submitTask', () => {
    it('should refund product price and credit earned commission in transaction', async () => {
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
  });
});
