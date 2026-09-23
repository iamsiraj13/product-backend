import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Role, AccountType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  private generateUniqueInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async register(dto: RegisterDto) {
    // 1. Validate mandatory referrer invitation code
    const referrer = await this.prisma.user.findUnique({
      where: { invitationCode: dto.invitationCode },
    });

    if (!referrer || !referrer.isActive) {
      throw new BadRequestException('Invalid or inactive invitation code');
    }

    // 2. Check for unique constraints
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === dto.username) {
        throw new ConflictException('Username is already taken');
      }
      if (dto.email && existingUser.email === dto.email) {
        throw new ConflictException('Email is already registered');
      }
      if (dto.phone && existingUser.phone === dto.phone) {
        throw new ConflictException('Phone number is already registered');
      }
    }

    // 3. Hash passwords & generate unique user invitation code
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const withdrawalPasswordHash = await bcrypt.hash(dto.withdrawalPassword, 10);
    let newUserInviteCode = this.generateUniqueInviteCode();

    // Ensure invite code is unique
    while (await this.prisma.user.findUnique({ where: { invitationCode: newUserInviteCode } })) {
      newUserInviteCode = this.generateUniqueInviteCode();
    }

    // 4. Create User
    const newUser = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        withdrawalPasswordHash,
        invitationCode: newUserInviteCode,
        role: Role.USER,
        accountType: AccountType.MAIN,
        invitedById: referrer.id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        accountType: true,
        balance: true,
        invitationCode: true,
        createdAt: true,
      },
    });

    const { accessToken } = await this.generateTokens(newUser.id, newUser.username, newUser.role, newUser.accountType);

    return {
      user: newUser,
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken } = await this.generateTokens(user.id, user.username, user.role, user.accountType);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountType: user.accountType,
        balance: user.balance,
        invitationCode: user.invitationCode,
      },
      accessToken,
    };
  }

  async generateTokens(userId: string, username: string, role: string, accountType: string) {
    const payload = { sub: userId, username, role, accountType };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'product_platform_access_secret_key_2026_super_secure!';

    const accessExpiration = this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiration as any,
    });

    return {
      accessToken,
    };
  }
}
