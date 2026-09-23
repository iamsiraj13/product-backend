import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [PrismaModule],
  controllers: [WithdrawalsController, AdminWithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
