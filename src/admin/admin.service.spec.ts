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
      findMany: jest.fn(),
    },
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
});

