import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';
import { getBaseUrl, formatImageUrl } from '../common/utils/url.util';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve all active home products only (isHomeProduct: true, isActive: true).
   */
  async getHomeProducts(req?: Request) {
    const products = await this.prisma.product.findMany({
      where: {
        isHomeProduct: true,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const baseUrl = req ? getBaseUrl(req) : '';
    return products.map((product) => ({
      ...product,
      image: formatImageUrl(product.image, baseUrl),
    }));
  }
}
