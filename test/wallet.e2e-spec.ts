import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoNetwork } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Wallet Routes (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let validToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    prisma = app.get<PrismaService>(PrismaService);

    const testUser = await prisma.user.findFirst({
      where: { isActive: true },
    });

    if (testUser) {
      testUserId = testUser.id;
    } else {
      testUserId = 'test-e2e-user-id';
    }

    const secret =
      process.env.JWT_ACCESS_SECRET ||
      'product_platform_access_secret_key_2026_super_secure!';

    validToken = jwtService.sign(
      {
        sub: testUserId,
        username: testUser ? testUser.username : 'testuser',
        role: testUser ? testUser.role : 'USER',
        accountType: testUser ? testUser.accountType : 'REGULAR',
      },
      {
        secret,
        expiresIn: '1h',
      },
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /api/v1/wallet/addresses', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/wallet/addresses')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 401,
        message: 'Invalid or expired authentication token',
      });
    });

    it('should return 401 when invalid token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/wallet/addresses')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 401,
        message: 'Invalid or expired authentication token',
      });
    });

    it('should return 200 and list of addresses when valid token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/wallet/addresses')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/wallet/addresses', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/wallet/addresses')
        .send({
          network: CryptoNetwork.TRC20,
          address: 'TYDzsYmc2V4LmyDhEPdGms83G355yks1ze',
        })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 401,
        message: 'Invalid or expired authentication token',
      });
    });

    it('should return 400 when address format is invalid for TRC20', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/wallet/addresses')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          network: CryptoNetwork.TRC20,
          address: 'invalid_address',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 200 and save address when valid token and data are provided', async () => {
      const validTrc20Address = 'TYDzsYmc2V4LmyDhEPdGms83G355yks1ze';
      const res = await request(app.getHttpServer())
        .post('/api/v1/wallet/addresses')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          network: CryptoNetwork.TRC20,
          address: validTrc20Address,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('TRC20 wallet address saved successfully');
      expect(res.body.data.data.address).toBe(validTrc20Address);
    });
  });
});
