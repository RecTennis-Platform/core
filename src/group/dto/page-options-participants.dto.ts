import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';

export class PageOptionsParticipantsDto {
  @IsEnum(Order)
  @IsOptional()
  order?: Order = Order.DESC;

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
