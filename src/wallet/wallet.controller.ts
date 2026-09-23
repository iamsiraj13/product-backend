import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SaveWalletAddressDto } from './dto/save-wallet-address.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) { }

  @Get('addresses')
  @ApiOperation({ summary: 'Get current user saved wallet addresses' })
  async getAddresses(@CurrentUser('id') userId: string) {
    return this.walletService.getUserWalletAddresses(userId);
  }

  @Post('addresses')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save or update wallet address for a network' })
  async saveAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveWalletAddressDto,
  ) {
    return this.walletService.saveWalletAddress(userId, dto);
  }
}
