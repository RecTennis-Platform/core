import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaymentService } from 'src/services/payment/payment.service';
import { PackageService } from 'src/package/package.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PaymentService, PackageService],
})
export class OrderModule {}
