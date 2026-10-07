import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeWithdrawalPasswordDto } from './dto/change-withdrawal-password.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @ApiOperation({ summary: 'Get current user profile and account details' })
  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Update user profile picture / avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'User profile image file',
        },
      },
      required: ['avatar'],
    },
  })
  @Patch('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image file is required');
    }
    return this.usersService.updateAvatar(userId, file);
  }

  @ApiOperation({ summary: 'Update user profile picture / avatar (PUT alias)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'User profile image file',
        },
      },
      required: ['avatar'],
    },
  })
  @Put('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateAvatarPut(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image file is required');
    }
    return this.usersService.updateAvatar(userId, file);
  }

  @ApiOperation({ summary: 'Change user account login password' })
  @HttpCode(HttpStatus.OK)
  @Post('profile/change-password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }




  @ApiOperation({ summary: 'Change user withdrawal password / transaction PIN' })
  @HttpCode(HttpStatus.OK)
  @Post('profile/change-withdrawal-password')
  async changeWithdrawalPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeWithdrawalPasswordDto,
  ) {
    return this.usersService.changeWithdrawalPassword(userId, dto);
  }




}
