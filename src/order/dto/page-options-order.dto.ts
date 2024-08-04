import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Order } from '../../../constants/order';
import { OrderStatus } from '@prisma/client';

export class PageOptionsOrderDto {
  @IsEnum(Order)
  @IsOptional()
  order?: Order = Order.DESC;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  userId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  @IsOptional()
  take?: number = 1000;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
export enum StatisticOrderTime {
  year = 'year',
  quarter = 'quarter',
  month = 'month',
}
export class StatisticOrderDto {
  @IsEnum(StatisticOrderTime)
  @IsOptional()
  time?: StatisticOrderTime;

  @Transform(({ value }) => Number(value), { toClassOnly: true })
  @IsNumber()
  @IsOptional()
  year?: number;
}
