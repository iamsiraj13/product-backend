import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProducts = [
    {
      id: 'prod-1',
      title: 'Home Product 1',
      image: '/uploads/home1.jpg',
      price: new Prisma.Decimal(100.0),
      commissionRate: new Prisma.Decimal(2.0),
      commission: new Prisma.Decimal(2.0),
      isHomeProduct: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-2',
      title: 'Home Product 2',
      image: 'http://example.com/home2.jpg',
      price: new Prisma.Decimal(250.0),
      commissionRate: new Prisma.Decimal(2.5),
      commission: new Prisma.Decimal(6.25),
      isHomeProduct: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHomeProducts', () => {
    it('should query prisma for isHomeProduct: true and isActive: true', async () => {
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const mockReq = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:4000'),
        headers: { host: 'localhost:4000' },
      } as any;

      const result = await service.getHomeProducts(mockReq);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          isHomeProduct: true,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].image).toBe('http://localhost:4000/uploads/home1.jpg');
      expect(result[1].image).toBe('http://example.com/home2.jpg');
    });
  });
});
