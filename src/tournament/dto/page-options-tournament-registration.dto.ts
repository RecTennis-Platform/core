import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';
import { RegistrationStatus } from '@prisma/client';

export class PageOptionsTournamentRegistrationDto {
  // Tournament registration filters
  @IsEnum(RegistrationStatus)
  @IsOptional()
  readonly status?: RegistrationStatus;

  // Pagination options
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
  @Max(5000)
  @IsOptional()
  readonly take?: number = 1000;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
