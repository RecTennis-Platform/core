import {
  IsEnum,
  IsString,
  IsInt,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export enum PartnerPayment {
  vnpay = 'VNPAY',
}

export class CreateOrderDto {
  @IsOptional()
  userId: string;

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
