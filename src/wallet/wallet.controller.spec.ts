import { Test, TestingModule } from '@nestjs/testing';
import { CryptoNetwork } from '@prisma/client';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

describe('WalletController', () => {
  let controller: WalletController;
  let service: WalletService;

  const mockWalletService = {
    getUserWalletAddresses: jest.fn(),
    saveWalletAddress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
    service = module.get<WalletService>(WalletService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /addresses (getAddresses)', () => {
    it('should call getUserWalletAddresses with userId', async () => {
      const mockAddresses = [
        {
          id: '1',
          network: CryptoNetwork.TRC20,
          address: 'TYDzsYmc2V4LmyDhEPdGms83G355yks1ze',
        },
      ];
      mockWalletService.getUserWalletAddresses.mockResolvedValue(mockAddresses);

      const result = await controller.getAddresses('user-123');

      expect(result).toEqual(mockAddresses);
      expect(mockWalletService.getUserWalletAddresses).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('POST /addresses (saveAddress)', () => {
    it('should call saveWalletAddress with userId and dto', async () => {
      const dto = {
        network: CryptoNetwork.TRC20,
        address: 'TYDzsYmc2V4LmyDhEPdGms83G355yks1ze',
      };
      const mockResponse = {
        message: 'TRC20 wallet address saved successfully',
        data: { id: '1', ...dto },
      };
      mockWalletService.saveWalletAddress.mockResolvedValue(mockResponse);

      const result = await controller.saveAddress('user-123', dto);

      expect(result).toEqual(mockResponse);
      expect(mockWalletService.saveWalletAddress).toHaveBeenCalledWith(
        'user-123',
        dto,
      );
    });
  });
});
