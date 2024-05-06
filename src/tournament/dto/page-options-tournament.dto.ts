import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';
import {
  Gender,
  TournamentFormat,
  TournamentPhase,
  TournamentStatus,
} from '@prisma/client';

export class PageOptionsTournamentDto {
  // Tournament filters
  @IsEnum(Gender)
  @IsOptional()
  readonly gender?: Gender;

  @IsEnum(TournamentFormat)
  @IsOptional()
  readonly format?: TournamentFormat;

  @IsEnum(TournamentStatus)
  @IsOptional()
  readonly status?: TournamentStatus;

  @IsEnum(TournamentPhase)
  @IsOptional()
  readonly phase?: TournamentPhase;

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
  @Max(50)
  @IsOptional()
  readonly take?: number = 10;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
