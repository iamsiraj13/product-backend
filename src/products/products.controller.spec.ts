import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockProducts = [
    {
      id: 'prod-1',
      title: 'Home Product 1',
      image: 'http://localhost:4000/uploads/home1.jpg',
      price: 100.0,
      commissionRate: 2.0,
      commission: 2.0,
      isHomeProduct: true,
      isActive: true,
    },
  ];

  const mockProductsService = {
    getHomeProducts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHomeProducts', () => {
    it('should call productsService.getHomeProducts for /products/home', async () => {
      mockProductsService.getHomeProducts.mockResolvedValue(mockProducts);
      const mockReq = {} as any;

      const result = await controller.getHomeProducts(mockReq);

      expect(mockProductsService.getHomeProducts).toHaveBeenCalledWith(mockReq);
      expect(result).toEqual(mockProducts);
    });

    it('should call productsService.getHomeProducts for alias /home-products', async () => {
      mockProductsService.getHomeProducts.mockResolvedValue(mockProducts);
      const mockReq = {} as any;

      const result = await controller.getHomeProductsAlias(mockReq);

      expect(mockProductsService.getHomeProducts).toHaveBeenCalledWith(mockReq);
      expect(result).toEqual(mockProducts);
    });
  });
});
