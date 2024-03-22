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

  async createPayment(data: CreatePaymentUrlRequest) {
    const method = 'POST';

    const body = JSON.stringify({
      amount: data.amount,
      clientIp: data.clientIp,
      orderId: data.orderId,
      locale: data.locale,
      partner: data.partner,
    });

    try {
      const response = await fetch(
        process.env.PAYMENT_SERVICE_URL + '/v1/payment',
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Payment creation failed with status: ${response.status}`,
        );
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error('Error creating payment:', error);
      return error;
    }
  }
}
