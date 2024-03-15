import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaymentService } from 'src/services/payment/payment.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PaymentService],
})
export class OrderModule {}
