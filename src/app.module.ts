import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { AdminModule } from './admin/admin.module';
import { TasksModule } from './tasks/tasks.module';
import { ProductsModule } from './products/products.module';
import { WalletModule } from './wallet/wallet.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: path.resolve(
            config.get<string>('UPLOAD_DIR') || './uploads',
          ),
          serveRoot: '/uploads',
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StorageModule,
    AdminModule,
    TasksModule,
    ProductsModule,
    WalletModule,
    WithdrawalsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
