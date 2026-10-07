import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UsersService - Password Operations', () => {
  let service: UsersService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '', // Will populate in beforeEach
    withdrawalPasswordHash: '', // Will populate in beforeEach
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('oldPassword123', 10);
    mockUser.withdrawalPasswordHash = await bcrypt.hash('123456', 10);

    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockStorage = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  describe('changePassword', () => {
    it('should successfully update password when valid old password is provided', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
      });

      const result = await service.changePassword('user-uuid-123', {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      });

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-123' },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        }),
      );
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-uuid-123', {
          oldPassword: 'wrongPassword',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when confirmPassword does not match newPassword', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-uuid-123', {
          oldPassword: 'oldPassword123',
          newPassword: 'newPassword123',
          confirmPassword: 'differentPassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when newPassword is identical to oldPassword', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-uuid-123', {
          oldPassword: 'oldPassword123',
          newPassword: 'oldPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeWithdrawalPassword', () => {
    it('should successfully update withdrawal password when valid old withdrawal password is provided', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
      });

      const result = await service.changeWithdrawalPassword('user-uuid-123', {
        oldWithdrawalPassword: '123456',
        newWithdrawalPassword: '654321',
        confirmWithdrawalPassword: '654321',
      });

      expect(result).toEqual({ message: 'Withdrawal password updated successfully' });
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-123' },
          data: expect.objectContaining({
            withdrawalPasswordHash: expect.any(String),
          }),
        }),
      );
    });

    it('should throw BadRequestException when old withdrawal password is wrong', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.changeWithdrawalPassword('user-uuid-123', {
          oldWithdrawalPassword: 'wrongPin',
          newWithdrawalPassword: '654321',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when old withdrawal password is required but omitted', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.changeWithdrawalPassword('user-uuid-123', {
          newWithdrawalPassword: '654321',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow setting withdrawal password for the first time if withdrawalPasswordHash is null', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        withdrawalPasswordHash: null,
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
      });

      const result = await service.changeWithdrawalPassword('user-uuid-123', {
        newWithdrawalPassword: '654321',
      });

      expect(result).toEqual({ message: 'Withdrawal password updated successfully' });
    });
  });
});
