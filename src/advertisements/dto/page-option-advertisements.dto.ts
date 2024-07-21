import { AdvertisementStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from 'constants/order';

export class PageOptionsAdvertisementDto {
  @IsEnum(Order)
  @IsOptional()
  order?: Order = Order.DESC;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  @IsOptional()
  take?: number = 1000;

  @IsEnum(AdvertisementStatus)
  @IsOptional()
  status?: AdvertisementStatus;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
