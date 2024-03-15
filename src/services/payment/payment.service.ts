import { Injectable } from '@nestjs/common';
import {
  ClientGrpc,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  PAYMENT_SERVICE_NAME,
  PB_PACKAGE_NAME,
  PaymentClient,
  CreatePaymentUrlRequest,
  CreatePaymentUrlResponse,
} from 'src/proto/payment_service.pb';

@Injectable()
export class PaymentService {
  private readonly grpcClient: ClientGrpc;
  private readonly paymentServiceClient: PaymentClient;
  constructor() {
    this.grpcClient = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: PB_PACKAGE_NAME,
        protoPath: 'src/proto/payment_service.proto',
        url: process.env.PAYMENT_SERVICE_URL,
      },
    });
    this.paymentServiceClient =
      this.grpcClient.getService<PaymentClient>(PAYMENT_SERVICE_NAME);
  }

  createPaymentUrl(
    data: CreatePaymentUrlRequest,
  ): Observable<CreatePaymentUrlResponse> {
    return this.paymentServiceClient.createPaymentLink(data);
  }
}
