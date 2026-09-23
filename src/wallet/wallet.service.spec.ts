import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoNetwork } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: PrismaService;

  const mockPrismaService = {
    walletAddress: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserWalletAddresses', () => {
    it('should return user wallet addresses', async () => {
      const mockAddresses = [
        {
          id: '1',
          network: CryptoNetwork.TRC20,
          address: 'TYDzsYmc2V4LmyDhEPdGms83G355yks1ze',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.walletAddress.findMany.mockResolvedValue(mockAddresses);

      const result = await service.getUserWalletAddresses('user-1');

      expect(result).toEqual(mockAddresses);
      expect(mockPrismaService.walletAddress.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          id: true,
          network: true,
          address: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('saveWalletAddress', () => {
    it('should save valid TRC20 address', async () => {
      const dto = {
        network: CryptoNetwork.TRC20,
        address: 'TYDzsYmc2V4LmyDhEPdGms83G355yks1ze',
      };
      const mockSaved = {
        id: '1',
        userId: 'user-1',
        network: CryptoNetwork.TRC20,
        address: dto.address,
      };

      mockPrismaService.walletAddress.upsert.mockResolvedValue(mockSaved);

      const result = await service.saveWalletAddress('user-1', dto);

      expect(result).toEqual({
        message: 'TRC20 wallet address saved successfully',
        data: mockSaved,
      });
      expect(mockPrismaService.walletAddress.upsert).toHaveBeenCalled();
    });

    it('should save any string wallet address format', async () => {
      const dto = {
        network: CryptoNetwork.TRC20,
        address: 'custom_string_address_123',
      };
      const mockSaved = {
        id: '1',
        userId: 'user-1',
        network: CryptoNetwork.TRC20,
        address: dto.address,
      };

      mockPrismaService.walletAddress.upsert.mockResolvedValue(mockSaved);

      const result = await service.saveWalletAddress('user-1', dto);

      expect(result.data).toEqual(mockSaved);
    });

    it('should save valid ERC20 address', async () => {
      const dto = {
        network: CryptoNetwork.ERC20,
        address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      };
      const mockSaved = {
        id: '2',
        userId: 'user-1',
        network: CryptoNetwork.ERC20,
        address: dto.address,
      };

      mockPrismaService.walletAddress.upsert.mockResolvedValue(mockSaved);

      const result = await service.saveWalletAddress('user-1', dto);

      expect(result.data).toEqual(mockSaved);
    });

    it('should throw BadRequestException for empty address', async () => {
      const dto = {
        network: CryptoNetwork.TRC20,
        address: '   ',
      };

      await expect(service.saveWalletAddress('user-1', dto)).rejects.toThrow(
        'Wallet address cannot be empty',
      );
    });
  });
});
