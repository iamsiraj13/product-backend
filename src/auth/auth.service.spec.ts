import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn().mockResolvedValue('mocked_jwt_token'),
    verify: jest.fn(),
  })),
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'secret';
      return null;
    }),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;

  const mockReferrer = {
    id: 'ref-123',
    username: 'referrer_user',
    invitationCode: 'REFCODE1',
    isActive: true,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mocked_jwt_token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw BadRequestException if invitation code is invalid', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.register({
          username: 'newuser',
          password: 'password123',
          withdrawalPassword: '123456',
          invitationCode: 'INVALID',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if username is already taken', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockReferrer);
      prismaService.user.findFirst.mockResolvedValue({ username: 'newuser' });

      await expect(
        service.register({
          username: 'newuser',
          password: 'password123',
          withdrawalPassword: '123456',
          invitationCode: 'REFCODE1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully register new user with valid invitation code', async () => {
      prismaService.user.findUnique
        .mockResolvedValueOnce(mockReferrer) // Referrer lookup
        .mockResolvedValueOnce(null); // Unique invite code check

      prismaService.user.findFirst.mockResolvedValue(null);

      const createdUser = {
        id: 'user-new',
        username: 'newuser',
        email: 'new@test.com',
        phone: null,
        role: 'USER',
        accountType: 'MAIN',
        balance: 0,
        invitationCode: 'RANDOM7',
        createdAt: new Date(),
      };

      prismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.register({
        username: 'newuser',
        password: 'password123',
        withdrawalPassword: '123456',
        email: 'new@test.com',
        invitationCode: 'REFCODE1',
      });

      expect(result.user).toEqual(createdUser);
      expect(result.accessToken).toBe('mocked_jwt_token');
      expect((result as any).refreshToken).toBeUndefined();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@test.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hash = await bcrypt.hash('correct_password', 10);
      prismaService.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'testuser',
        email: 'testuser@example.com',
        passwordHash: hash,
        isActive: true,
      });

      await expect(
        service.login({
          email: 'testuser@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully login user with correct email and password', async () => {
      const hash = await bcrypt.hash('correct_password', 10);
      const mockUser = {
        id: 'u1',
        username: 'testuser',
        email: 'testuser@example.com',
        phone: null,
        role: 'USER',
        accountType: 'MAIN',
        balance: 100,
        invitationCode: 'CODE123',
        passwordHash: hash,
        isActive: true,
      };

      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'testuser@example.com',
        password: 'correct_password',
      });

      expect(result.user.email).toBe('testuser@example.com');
      expect(result.accessToken).toBe('mocked_jwt_token');
      expect((result as any).refreshToken).toBeUndefined();
    });
  });
});
