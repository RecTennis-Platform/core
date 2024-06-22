import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from '../../../constants/order';
import {
  Gender,
  GroupTournamentFormat,
  GroupTournamentPhase,
  GroupTournamentStatus,
  ParticipantType,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class PageOptionsGroupTournamentDto {
  // Tournament filters
  @IsEnum(Gender)
  @IsOptional()
  readonly gender?: Gender;

  @IsEnum(GroupTournamentFormat)
  @IsOptional()
  readonly format?: GroupTournamentFormat;

  @IsEnum(ParticipantType)
  @IsOptional()
  participantType?: ParticipantType;

  @IsEnum(GroupTournamentStatus)
  @IsOptional()
  readonly status?: GroupTournamentStatus;

  @IsEnum(GroupTournamentPhase)
  @IsOptional()
  readonly phase?: GroupTournamentPhase;

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
