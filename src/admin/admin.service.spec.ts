import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AdminService - Product Management', () => {
  let service: AdminService;

  const mockPrismaService = {
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productTask: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    it('should throw BadRequestException if image is missing', async () => {
      await expect(
        service.createProduct({ title: 'Test Product', price: 100 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create product with default 2% commissionRate and calculate commission ($4.00 for $200 price)', async () => {
      const dto = {
        title: 'Wireless Headphones',
        image: '/uploads/headphones.png',
        price: 200,
      };

      mockPrismaService.product.create.mockImplementation((args) =>
        Promise.resolve({ id: 'prod-1', ...args.data }),
      );

      const result = await service.createProduct(dto as any);

      expect(mockPrismaService.product.create).toHaveBeenCalledWith({
        data: {
          title: 'Wireless Headphones',
          image: '/uploads/headphones.png',
          price: new Prisma.Decimal(200),
          commissionRate: new Prisma.Decimal(2.0),
          commission: new Prisma.Decimal(4.0),
          isHomeProduct: false,
          isActive: true,
        },
      });
      expect(result.commission).toEqual(new Prisma.Decimal(4.0));
    });

    it('should calculate custom commission when custom commissionRate is provided', async () => {
      const dto = {
        title: 'Smart Watch',
        image: '/uploads/watch.png',
        price: 500,
        commissionRate: 5.0,
      };

      mockPrismaService.product.create.mockImplementation((args) =>
        Promise.resolve({ id: 'prod-2', ...args.data }),
      );

      const result = await service.createProduct(dto as any);

      expect(mockPrismaService.product.create).toHaveBeenCalledWith({
        data: {
          title: 'Smart Watch',
          image: '/uploads/watch.png',
          price: new Prisma.Decimal(500),
          commissionRate: new Prisma.Decimal(5.0),
          commission: new Prisma.Decimal(25.0),
          isHomeProduct: false,
          isActive: true,
        },
      });
      expect(result.commission).toEqual(new Prisma.Decimal(25.0));
    });
  });

  describe('updateProduct', () => {
    it('should throw NotFoundException if product is not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      await expect(
        service.updateProduct('non-existent', { price: 300 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update price and recalculate commission dynamically', async () => {
      const existingProduct = {
        id: 'prod-1',
        title: 'Old Title',
        image: '/uploads/old.png',
        price: new Prisma.Decimal(200),
        commissionRate: new Prisma.Decimal(2.0),
        commission: new Prisma.Decimal(4.0),
      };

      mockPrismaService.product.findUnique.mockResolvedValue(existingProduct);
      mockPrismaService.product.update.mockImplementation((args) =>
        Promise.resolve({ id: 'prod-1', ...args.data }),
      );

      await service.updateProduct('prod-1', { price: 400 });

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          price: new Prisma.Decimal(400),
          commissionRate: new Prisma.Decimal(2.0),
          commission: new Prisma.Decimal(8.0),
        },
      });
    });
  });

  describe('deleteProduct', () => {
    it('should throw NotFoundException if product is not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      await expect(service.deleteProduct('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should successfully delete product and associated tasks in transaction', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        title: 'Test Product',
      });
      mockPrismaService.$transaction = jest.fn((cb) => cb(mockPrismaService));
      mockPrismaService.productTask.deleteMany = jest
        .fn()
        .mockResolvedValue({ count: 1 });
      mockPrismaService.product.delete = jest
        .fn()
        .mockResolvedValue({ id: 'prod-1' });

      const result = await service.deleteProduct('prod-1');

      expect(mockPrismaService.productTask.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1' },
      });
      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(result).toEqual({
        message: 'Product deleted successfully',
        id: 'prod-1',
      });
    });
  });

  describe('getProducts', () => {
    it('should return paginated products with full image URLs and metadata', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          title: 'Product 1',
          image: '/uploads/img-1.jpg',
          price: new Prisma.Decimal(100),
          commissionRate: new Prisma.Decimal(2),
          commission: new Prisma.Decimal(2),
          isHomeProduct: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCount = jest.fn().mockResolvedValue(1);
      (mockPrismaService as any).product.count = mockCount;
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.getProducts({ page: 1, limit: 10, search: 'Product' });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data[0].image).toContain('/uploads/img-1.jpg');
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('updateUser', () => {
    it('should throw NotFoundException if target user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUser('non-existent-user', { username: 'newname' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updated username, email, or phone is already taken by another user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1', username: 'user1' });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-2', username: 'taken_username' });

      await expect(
        service.updateUser('user-1', { username: 'taken_username' }),
      ).rejects.toThrow('Username, email, or phone is already in use by another user');
    });

    it('should successfully update user fields', async () => {
      const existingUser = {
        id: 'user-1',
        username: 'oldname',
        email: 'old@example.com',
        phone: '+111111111',
        role: 'USER',
        accountType: 'MAIN',
        balance: new Prisma.Decimal(0),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        username: 'updatedname',
        email: 'updated@example.com',
      });

      const result = await service.updateUser('user-1', {
        username: 'updatedname',
        email: 'updated@example.com',
      });

      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(result.username).toBe('updatedname');
    });
  });

  describe('deleteUser', () => {
    it('should throw BadRequestException if admin tries to delete their own account', async () => {
      await expect(service.deleteUser('admin-1', 'admin-1')).rejects.toThrow(
        'You cannot delete your own account',
      );
    });

    it('should throw NotFoundException if target user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteUser('admin-1', 'user-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should successfully delete user and clean up dependent relations in transaction', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1', username: 'to_delete' });
      mockPrismaService.$transaction = jest.fn((cb) => cb(mockPrismaService));
      mockPrismaService.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrismaService.productTask = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
      mockPrismaService.transaction = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
      mockPrismaService.user.delete = jest.fn().mockResolvedValue({ id: 'user-1' });

      const result = await service.deleteUser('admin-1', 'user-1');

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toEqual({ message: 'User deleted successfully', id: 'user-1' });
    });
  });

  describe('preGenerateUserTasks', () => {
    it('should pre-generate 33 tasks by default when count is omitted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        taskLimit: 33,
      });
      mockPrismaService.productTask.count = jest.fn().mockResolvedValue(0);
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod-1', price: new Prisma.Decimal(100), commissionRate: new Prisma.Decimal(2) },
      ]);
      mockPrismaService.productTask.createMany = jest.fn().mockResolvedValue({ count: 33 });
      mockPrismaService.productTask.findMany = jest.fn().mockResolvedValue(new Array(33).fill({ id: 'task' }));

      const result = await service.preGenerateUserTasks('user-1', {});

      expect(mockPrismaService.productTask.createMany).toHaveBeenCalled();
      const createData = mockPrismaService.productTask.createMany.mock.calls[0][0].data;
      expect(createData.length).toBe(33);
      expect(result.totalTasks).toBe(33);
    });

    it('should throw BadRequestException if user already has 33 tasks pre-generated', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        taskLimit: 33,
      });
      mockPrismaService.productTask.count = jest.fn().mockResolvedValue(33);

      await expect(service.preGenerateUserTasks('user-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('overrideTaskCommission', () => {
    it('should throw NotFoundException if task to override does not exist', async () => {
      mockPrismaService.productTask.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.overrideTaskCommission('non-existent-task', { commissionSnapshot: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no fields are passed in DTO', async () => {
      mockPrismaService.productTask.findUnique = jest.fn().mockResolvedValue({ id: 'task-1' });

      await expect(
        service.overrideTaskCommission('task-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully override price and commission snapshot for a task step', async () => {
      const existingTask = {
        id: 'task-1',
        stepNumber: 2,
        priceSnapshot: new Prisma.Decimal('100.00'),
        commissionSnapshot: new Prisma.Decimal('5.00'),
      };

      mockPrismaService.productTask.findUnique = jest.fn().mockResolvedValue(existingTask);
      mockPrismaService.productTask.update = jest.fn().mockResolvedValue({
        ...existingTask,
        priceSnapshot: new Prisma.Decimal('200.00'),
        commissionSnapshot: new Prisma.Decimal('12.00'),
      });

      const result = await service.overrideTaskCommission('task-1', {
        priceSnapshot: 200.0,
        commissionSnapshot: 12.0,
      });

      expect(mockPrismaService.productTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          priceSnapshot: new Prisma.Decimal(200.0),
          commissionSnapshot: new Prisma.Decimal(12.0),
        },
        include: { product: true },
      });
      expect(result.task.priceSnapshot).toEqual(new Prisma.Decimal('200.00'));
      expect(result.task.commissionSnapshot).toEqual(new Prisma.Decimal('12.00'));
    });

    it('should successfully override task when passing alias field names (price, commission / commissionRate)', async () => {
      const existingTask = {
        id: 'task-2',
        stepNumber: 3,
        priceSnapshot: new Prisma.Decimal('100.00'),
        commissionSnapshot: new Prisma.Decimal('5.00'),
      };

      mockPrismaService.productTask.findUnique = jest.fn().mockResolvedValue(existingTask);
      mockPrismaService.productTask.update = jest.fn().mockResolvedValue({
        ...existingTask,
        priceSnapshot: new Prisma.Decimal('500.00'),
        commissionSnapshot: new Prisma.Decimal('15.00'),
      });

      const result = await service.overrideTaskCommission('task-2', {
        price: 500.0,
        commissionRate: 15.0,
      });

      expect(mockPrismaService.productTask.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          priceSnapshot: new Prisma.Decimal(500.0),
          commissionSnapshot: new Prisma.Decimal(15.0),
        },
        include: { product: true },
      });
      expect(result.task.priceSnapshot).toEqual(new Prisma.Decimal('500.00'));
    });
  });
});

