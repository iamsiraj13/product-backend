import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustBalanceDto,
  CreateAgentDto,
  CreateTrainingAccountDto,
  UserQueryDto,
  ProductQueryDto,
} from './dto/admin.dto';
import { getBaseUrl, formatImageUrl } from '../common/utils/url.util';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.AGENT)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly storageService: StorageService,
  ) {}

  // Local Image Upload Endpoint
  @ApiOperation({ summary: 'Upload image file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    const relativeUrl = await this.storageService.saveFile(file);
    const baseUrl = getBaseUrl(req);
    return { url: formatImageUrl(relativeUrl, baseUrl) };
  }

  // Marketplace Product Management
  @ApiOperation({ summary: 'Create new marketplace product with direct image file upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Wireless Headphones' },
        price: { type: 'number', example: 200.0 },
        commissionRate: { type: 'number', example: 2.0, description: 'Default 2%' },
        commission: { type: 'number', example: 4.0, description: 'Calculated automatically if omitted' },
        isHomeProduct: { type: 'boolean', example: false },
        isActive: { type: 'boolean', example: true },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Upload product image file directly',
        },
      },
      required: ['title', 'price'],
    },
  })
  @Post('products')
  @UseInterceptors(FileInterceptor('image'))
  async createProduct(
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: Request,
  ) {
    if (file) {
      dto.image = await this.storageService.saveFile(file);
    }
    return this.adminService.createProduct(dto, req);
  }

  @ApiOperation({ summary: 'Update marketplace product with optional direct image file upload' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Updated Wireless Headphones' },
        price: { type: 'number', example: 250.0 },
        commissionRate: { type: 'number', example: 2.5 },
        commission: { type: 'number', example: 6.25 },
        isHomeProduct: { type: 'boolean', example: true },
        isActive: { type: 'boolean', example: true },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Upload new product image file directly',
        },
      },
    },
  })
  @Put('products/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: Request,
  ) {
    if (file) {
      dto.image = await this.storageService.saveFile(file);
    }
    return this.adminService.updateProduct(id, dto, req);
  }

  @ApiOperation({ summary: 'Get paginated list of marketplace products' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search filter by title' })
  @ApiQuery({ name: 'isHomeProduct', required: false, type: Boolean, description: 'Filter by home page feature status' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Items per page (default 10)' })
  @Get('products')
  async getProducts(
    @Query() query: ProductQueryDto,
    @Req() req: Request,
  ) {
    return this.adminService.getProducts(query, req);
  }

  // User Accounts Search & Query
  @ApiOperation({ summary: 'Search and query user accounts' })
  @Get('users')
  async getUsers(@Query() query: UserQueryDto) {
    return this.adminService.getUsers(query);
  }

  // Manual Financial Balance Adjustment
  @ApiOperation({ summary: 'Manually adjust user balance (CREDIT/DEBIT)' })
  @ApiParam({ name: 'id', description: 'Target user ID' })
  @Post('users/:id/balance')
  async adjustBalance(
    @CurrentUser('id') adminId: string,
    @Param('id') targetUserId: string,
    @Body() dto: AdjustBalanceDto,
  ) {
    return this.adminService.adjustBalance(adminId, targetUserId, dto);
  }

  // Provision Training Account Linked to Parent User
  @ApiOperation({ summary: 'Provision training account linked to user' })
  @ApiParam({ name: 'id', description: 'Parent user ID' })
  @Post('users/:id/training-account')
  async createTrainingAccount(
    @Param('id') parentUserId: string,
    @Body() dto: CreateTrainingAccountDto,
  ) {
    return this.adminService.createTrainingAccount(parentUserId, dto);
  }

  // Onboard New Agent (Only ADMIN role can create agents)
  @ApiOperation({ summary: 'Onboard new agent account (ADMIN only)' })
  @Post('agents')
  @Roles(Role.ADMIN)
  async createAgent(@Body() dto: CreateAgentDto) {
    return this.adminService.createAgent(dto);
  }
}
