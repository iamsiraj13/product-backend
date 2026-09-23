import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalQueryDto } from './dto/withdrawal-query.dto';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('Withdrawals')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new withdrawal request' })
  async createWithdrawal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.createWithdrawal(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get current user withdrawal history' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: WithdrawalQueryDto,
  ) {
    return this.withdrawalsService.getUserWithdrawalHistory(userId, query);
  }
}
