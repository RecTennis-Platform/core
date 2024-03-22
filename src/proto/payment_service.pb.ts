/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { Timestamp } from './google/protobuf/timestamp.pb';

export const protobufPackage = 'pb';

export interface CreatePaymentUrlRequest {
  amount: number;
  bankCode?: string | undefined;
  locale: string;
  orderType?: string | undefined;
  orderId: string;
  partner: string;
  clientIp: string;
  returnUrl: string;
}

export interface CreatePaymentUrlResponse {
  url: string;
}

export interface QueryTransactionRequest {
  orderId: string;
  clientIp: string;
}

export interface QueryTransactionResponse {
  responseId: string;
  partnerCode: string;
  transactionNo: string;
  transactionType: string;
  transactionStatus: string;
  promotionCode: string;
  promotionAmount: string;
  trace: string;
  feeAmount: number;
  amount: number;
  orderId: string;
  responseCode: string;
  responseMessage: string;
  bankCode: string;
  cardHolder: string;
  cardNumber: string;
  paymentTime: Timestamp | undefined;
}

export interface RefundRequest {
  orderId: string;
  createdBy: string;
  amount: number;
  transactionType: string;
  clientIp: string;
}

export interface RefundResponse {
  responseId: string;
  partnerCode: string;
  transactionNo: string;
  transactionType: string;
  transactionStatus: string;
  amount: number;
  orderId: string;
  responseCode: string;
  responseMessage: string;
  bankCode: string;
  paymentTime: Timestamp | undefined;
}

export interface ReturnUrlRequest {
  queryString: string;
  partnerCode: string;
}

export interface ReturnUrlResponse {
  message: string;
}

export const PB_PACKAGE_NAME = 'pb';

export interface PaymentClient {
  createPaymentLink(
    request: CreatePaymentUrlRequest,
  ): Observable<CreatePaymentUrlResponse>;

  returnUrl(request: ReturnUrlRequest): Observable<ReturnUrlResponse>;

  queryTransaction(
    request: QueryTransactionRequest,
  ): Observable<QueryTransactionResponse>;

  refund(request: RefundRequest): Observable<RefundResponse>;
}

export interface PaymentController {
  createPaymentLink(
    request: CreatePaymentUrlRequest,
  ):
    | Promise<CreatePaymentUrlResponse>
    | Observable<CreatePaymentUrlResponse>
    | CreatePaymentUrlResponse;

  returnUrl(
    request: ReturnUrlRequest,
  ):
    | Promise<ReturnUrlResponse>
    | Observable<ReturnUrlResponse>
    | ReturnUrlResponse;

  queryTransaction(
    request: QueryTransactionRequest,
  ):
    | Promise<QueryTransactionResponse>
    | Observable<QueryTransactionResponse>
    | QueryTransactionResponse;

  refund(
    request: RefundRequest,
  ): Promise<RefundResponse> | Observable<RefundResponse> | RefundResponse;
}

export function PaymentControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = [
      'createPaymentLink',
      'returnUrl',
      'queryTransaction',
      'refund',
    ];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcMethod('Payment', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcStreamMethod('Payment', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
  };
}

export const PAYMENT_SERVICE_NAME = 'Payment';
