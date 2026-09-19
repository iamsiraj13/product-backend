import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @ApiOperation({ summary: 'Get all active home products only' })
  @ApiResponse({
    status: 200,
    description: 'Returns array of active home products',
  })
  @Get('products/home')
  async getHomeProducts(@Req() req: Request) {
    return this.productsService.getHomeProducts(req);
  }

  @ApiOperation({ summary: 'Get all active home products (Alias route)' })
  @Get('home-products')
  async getHomeProductsAlias(@Req() req: Request) {
    return this.productsService.getHomeProducts(req);
  }


}
