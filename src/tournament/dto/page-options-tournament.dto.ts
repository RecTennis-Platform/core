import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';
import { RegistrationStatus } from '@prisma/client';

export class PageOptionsTournamentDto {
  @IsString()
  @IsOptional()
  readonly status?: RegistrationStatus = null;

  @IsEnum(Order)
  @IsOptional()
  readonly order?: Order = Order.DESC;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  readonly take?: number = 10;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
