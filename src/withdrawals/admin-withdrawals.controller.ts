import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { WithdrawalQueryDto } from './dto/withdrawal-query.dto';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('Admin - Withdrawals')
@ApiBearerAuth('JWT-auth')
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/withdrawals')
export class AdminWithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) { }

  @Get()
  @ApiOperation({ summary: 'List all withdrawal requests (Admin)' })
  async getAllWithdrawals(@Query() query: WithdrawalQueryDto) {
    return this.withdrawalsService.getAllWithdrawalsForAdmin(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update withdrawal request status - Approve or Reject (Admin)' })
  async updateWithdrawalStatus(
    @Param('id') withdrawalId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateWithdrawalStatusDto,
  ) {
    return this.withdrawalsService.updateWithdrawalStatus(withdrawalId, adminId, dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a withdrawal request (Admin)' })
  async approveWithdrawal(
    @Param('id') withdrawalId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.withdrawalsService.approveWithdrawal(withdrawalId, adminId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal request and refund balance (Admin)' })
  async rejectWithdrawal(
    @Param('id') withdrawalId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawalsService.rejectWithdrawal(withdrawalId, adminId, dto);
  }
}
