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

export enum CreateOrderEnum {
  upgrade = 'upgrade',
  renew = 'renew',
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

export class UpgradeOrderDto {
  @IsString()
  @IsNotEmpty()
  purchasedPackageId: string;

  @IsEnum(CreateOrderEnum)
  @IsNotEmpty()
  type: CreateOrderEnum;

  @IsEnum(PartnerPayment)
  @IsNotEmpty()
  partner?: PartnerPayment;
}
