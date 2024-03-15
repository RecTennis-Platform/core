import { IsEnum, IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export enum PartnerPayment {
  vnpay = 'VNPAY',
}

export class CreateOrderDto {
  @IsInt()
  @IsNotEmpty()
  readonly userId: number;

  @IsInt()
  @IsNotEmpty()
  readonly packageId: number;

  @IsInt()
  @IsOptional()
  readonly groupId?: number;

  @IsEnum(PartnerPayment)
  @IsNotEmpty()
  partner?: PartnerPayment;
}
