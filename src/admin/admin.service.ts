import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustBalanceDto,
  CreateAgentDto,
  CreateTrainingAccountDto,
  UserQueryDto,
  ProductQueryDto,
  UpdateUserDto,
  SetUserTaskLimitDto,
  OverrideTaskCommissionDto,
  PreGenerateUserTasksDto,
} from './dto/admin.dto';
import { Role, AccountType, TransactionType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Request } from 'express';
import { getBaseUrl, formatImageUrl } from '../common/utils/url.util';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private generateUniqueInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // --- Product Management ---
  async createProduct(dto: CreateProductDto, req?: Request) {
    if (!dto.image) {
      throw new BadRequestException('Product image file or image URL is required');
    }

    const price = dto.price;
    const commissionRate = dto.commissionRate !== undefined ? dto.commissionRate : 2.0;
    const commission =
      dto.commission !== undefined
        ? dto.commission
        : Number((price * (commissionRate / 100)).toFixed(2));

    const product = await this.prisma.product.create({
      data: {
        title: dto.title,
        image: dto.image,
        price: new Prisma.Decimal(price),
        commissionRate: new Prisma.Decimal(commissionRate),
        commission: new Prisma.Decimal(commission),
        isHomeProduct: dto.isHomeProduct ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    const baseUrl = getBaseUrl(req);
    return {
      ...product,
      image: formatImageUrl(product.image, baseUrl),
    };
  }

  async updateProduct(id: string, dto: UpdateProductDto, req?: Request) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const dataToUpdate: Prisma.ProductUpdateInput = {};
    if (dto.title !== undefined) dataToUpdate.title = dto.title;
    if (dto.image !== undefined) dataToUpdate.image = dto.image;
    if (dto.isHomeProduct !== undefined) dataToUpdate.isHomeProduct = dto.isHomeProduct;
    if (dto.isActive !== undefined) dataToUpdate.isActive = dto.isActive;

    const currentPrice = Number(product.price);
    const currentRate = Number(product.commissionRate);

    const targetPrice = dto.price !== undefined ? dto.price : currentPrice;
    let targetRate = dto.commissionRate !== undefined ? dto.commissionRate : currentRate;
    let targetCommission: number;

    if (dto.commission !== undefined) {
      targetCommission = dto.commission;
      if (dto.commissionRate === undefined && targetPrice > 0) {
        targetRate = Number(((targetCommission / targetPrice) * 100).toFixed(2));
      }
    } else {
      targetCommission = Number((targetPrice * (targetRate / 100)).toFixed(2));
    }

    dataToUpdate.price = new Prisma.Decimal(targetPrice);
    dataToUpdate.commissionRate = new Prisma.Decimal(targetRate);
    dataToUpdate.commission = new Prisma.Decimal(targetCommission);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });

    const baseUrl = getBaseUrl(req);
    return {
      ...updatedProduct,
      image: formatImageUrl(updatedProduct.image, baseUrl),
    };
  }

  async getProducts(query?: ProductQueryDto, req?: Request) {
    const { search, isHomeProduct, isActive, page = 1, limit = 10 } = query || {};
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    if (isHomeProduct !== undefined) {
      where.isHomeProduct = isHomeProduct;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const baseUrl = getBaseUrl(req);
    const formattedProducts = products.map((product) => ({
      ...product,
      image: formatImageUrl(product.image, baseUrl),
    }));

    return {
      data: formattedProducts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- User Management ---
  async getUsers(query: UserQueryDto) {
    const { search, role, accountType, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { invitationCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (accountType) {
      where.accountType = accountType;
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          accountType: true,
          balance: true,
          invitationCode: true,
          parentUserId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.username || dto.email || dto.phone) {
      const conflicts = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.username ? [{ username: dto.username }] : []),
            ...(dto.email ? [{ email: dto.email }] : []),
            ...(dto.phone ? [{ phone: dto.phone }] : []),
          ],
        },
      });

      if (conflicts) {
        throw new ConflictException('Username, email, or phone is already in use by another user');
      }
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (dto.username !== undefined) dataToUpdate.username = dto.username;
    if (dto.email !== undefined) dataToUpdate.email = dto.email || null;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone || null;
    if (dto.password !== undefined) {
      dataToUpdate.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.role !== undefined) dataToUpdate.role = dto.role;
    if (dto.accountType !== undefined) dataToUpdate.accountType = dto.accountType;
    if (dto.balance !== undefined) dataToUpdate.balance = new Prisma.Decimal(dto.balance);
    if (dto.isActive !== undefined) dataToUpdate.isActive = dto.isActive;
    if (dto.taskLimit !== undefined) dataToUpdate.taskLimit = dto.taskLimit;

    return this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        accountType: true,
        balance: true,
        taskLimit: true,
        invitationCode: true,
        parentUserId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(adminId: string, id: string) {
    if (adminId === id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { invitedById: id },
        data: { invitedById: null },
      });

      await tx.user.updateMany({
        where: { parentUserId: id },
        data: { parentUserId: null },
      });

      await tx.productTask.deleteMany({
        where: { userId: id },
      });

      await tx.transaction.deleteMany({
        where: { userId: id },
      });

      await tx.user.delete({
        where: { id },
      });
    });

    return { message: 'User deleted successfully', id };
  }

  // --- Manual Financial Adjustment ---
  async adjustBalance(adminId: string, targetUserId: string, dto: AdjustBalanceDto) {
    return this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw new NotFoundException('Target user not found');
      }

      const balanceBefore = new Prisma.Decimal(targetUser.balance.toString());
      const adjustmentAmount = new Prisma.Decimal(dto.amount);
      let balanceAfter: Prisma.Decimal;

      if (dto.type === TransactionType.CREDIT) {
        balanceAfter = balanceBefore.add(adjustmentAmount);
      } else {
        balanceAfter = balanceBefore.sub(adjustmentAmount);
        if (balanceAfter.lessThan(0)) {
          throw new BadRequestException('Debit amount exceeds target user current balance');
        }
      }

      // Update User Balance
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { balance: balanceAfter },
        select: {
          id: true,
          username: true,
          balance: true,
          accountType: true,
        },
      });

      // Create Audit Transaction Log
      const transactionLog = await tx.transaction.create({
        data: {
          userId: targetUserId,
          type: dto.type,
          amount: adjustmentAmount,
          balanceBefore,
          balanceAfter,
          referenceType: 'ADMIN_ADJUSTMENT',
          referenceId: adminId,
          note: dto.note,
        },
      });

      return {
        user: updatedUser,
        transaction: transactionLog,
      };
    });
  }

  // --- Provision Linked Training Account ---
  async createTrainingAccount(parentUserId: string, dto: CreateTrainingAccountDto) {
    const parentUser = await this.prisma.user.findUnique({
      where: { id: parentUserId },
    });

    if (!parentUser) {
      throw new NotFoundException('Parent user not found');
    }

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
      throw new ConflictException('Username, email, or phone is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let inviteCode = this.generateUniqueInviteCode();

    while (await this.prisma.user.findUnique({ where: { invitationCode: inviteCode } })) {
      inviteCode = this.generateUniqueInviteCode();
    }

    const trainingUser = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        role: Role.USER,
        accountType: AccountType.TRAINING,
        parentUserId: parentUser.id,
        balance: new Prisma.Decimal(dto.initialBalance || 0),
        invitationCode: inviteCode,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        accountType: true,
        parentUserId: true,
        balance: true,
        invitationCode: true,
        createdAt: true,
      },
    });

    return trainingUser;
  }

  // --- Onboard New Agent ---
  async createAgent(dto: CreateAgentDto) {
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
      throw new ConflictException('Username, email, or phone is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let inviteCode = this.generateUniqueInviteCode();

    while (await this.prisma.user.findUnique({ where: { invitationCode: inviteCode } })) {
      inviteCode = this.generateUniqueInviteCode();
    }

    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        role: Role.AGENT,
        accountType: AccountType.MAIN,
        invitationCode: inviteCode,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        accountType: true,
        invitationCode: true,
        createdAt: true,
      },
    });
  }

  // --- Task Limit & Custom Task Commission Override ---

  // Set custom task limit for a user
  async setUserTaskLimit(userId: string, dto: SetUserTaskLimitDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { taskLimit: dto.taskLimit },
      select: {
        id: true,
        username: true,
        taskLimit: true,
      },
    });
  }

  // Get user's assigned task sequence
  async getUserTaskSequence(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, taskLimit: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tasks = await this.prisma.productTask.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { stepNumber: 'asc' },
    });

    return {
      user,
      taskCount: tasks.length,
      taskLimit: user.taskLimit,
      tasks,
    };
  }

  // Override commission rate / price / product snapshot for a specific task step
  async overrideTaskCommission(taskId: string, dto: OverrideTaskCommissionDto) {
    const task = await this.prisma.productTask.findUnique({
      where: { id: taskId },
      include: { product: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const commissionVal =
      dto.commissionSnapshot ?? dto.commissionRate ?? dto.commission;
    const priceVal = dto.priceSnapshot ?? dto.price;

    if (
      commissionVal === undefined &&
      priceVal === undefined &&
      !dto.productId
    ) {
      throw new BadRequestException(
        'At least one of price (priceSnapshot), commission (commissionRate/commissionSnapshot), or productId must be provided',
      );
    }

    const dataToUpdate: Prisma.ProductTaskUpdateInput = {};

    if (commissionVal !== undefined) {
      dataToUpdate.commissionSnapshot = new Prisma.Decimal(commissionVal);
    }

    if (priceVal !== undefined) {
      dataToUpdate.priceSnapshot = new Prisma.Decimal(priceVal);
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException('Specified product not found');
      }
      dataToUpdate.product = { connect: { id: dto.productId } };
      if (priceVal === undefined) {
        dataToUpdate.priceSnapshot = product.price;
      }
    }

    const updatedTask = await this.prisma.productTask.update({
      where: { id: taskId },
      data: dataToUpdate,
      include: { product: true },
    });

    return {
      message: `Successfully overridden task step #${updatedTask.stepNumber} (Price: $${updatedTask.priceSnapshot}, Commission: ${updatedTask.commissionSnapshot}%)`,
      task: updatedTask,
    };
  }

  // Pre-generate / Allocate tasks (default 33 tasks, max limit 33) for a user so admin can customize specific steps before user starts
  async preGenerateUserTasks(userId: string, dto: PreGenerateUserTasksDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const maxLimit = user.taskLimit || 33;

    // Get current maximum stepNumber for user
    const existingTasksCount = await this.prisma.productTask.count({
      where: { userId },
    });

    if (existingTasksCount >= maxLimit) {
      throw new BadRequestException(
        `User already has ${existingTasksCount} tasks pre-generated, reaching maximum limit of ${maxLimit} tasks`,
      );
    }

    const countRequested = dto?.count ?? 33;
    const countToGenerate = Math.min(countRequested, maxLimit - existingTasksCount);

    if (countToGenerate <= 0) {
      throw new BadRequestException(
        `Cannot pre-generate tasks. User has reached maximum task limit of ${maxLimit}`,
      );
    }

    // Get active products to pick from
    const activeProducts = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    if (activeProducts.length === 0) {
      throw new BadRequestException('No active products available to assign tasks');
    }

    const tasksToCreate: Prisma.ProductTaskCreateManyInput[] = [];

    for (let i = 0; i < countToGenerate; i++) {
      const stepNumber = existingTasksCount + i + 1;
      const randomProduct = activeProducts[Math.floor(Math.random() * activeProducts.length)];

      tasksToCreate.push({
        userId,
        productId: randomProduct.id,
        stepNumber,
        priceSnapshot: randomProduct.price,
        commissionSnapshot: randomProduct.commissionRate,
      });
    }

    await this.prisma.productTask.createMany({
      data: tasksToCreate,
    });

    const allUserTasks = await this.prisma.productTask.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { stepNumber: 'asc' },
    });

    return {
      message: `Pre-generated ${countToGenerate} task slots for user ${user.username}`,
      totalTasks: allUserTasks.length,
      tasks: allUserTasks,
    };
  }
}
