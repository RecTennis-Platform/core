import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';

export enum PackageType {
  TOURNAMENT = 'tournament',
  GROUP = 'group',
}
export class PageOptionsPackageDto {
  @IsEnum(Order)
  @IsOptional()
  order?: Order = Order.DESC;

  @IsEnum(PackageType)
  @IsOptional()
  type?: PackageType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  take?: number;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
