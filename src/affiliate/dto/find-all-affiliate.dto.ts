import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';
import { AffiliateStatus } from '@prisma/client';

export class PageOptionsAffiliateDto {
  @IsEnum(Order)
  @IsOptional()
  readonly order?: Order = Order.DESC;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  @IsOptional()
  readonly take?: number;

  @IsEnum(AffiliateStatus)
  @IsOptional()
  readonly status?: AffiliateStatus;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
