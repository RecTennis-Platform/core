import { FundStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateTournamentFundDto {
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  reminderDate?: Date;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;
}

export class UpdateTournamentFundDto {
  @IsOptional()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  message: string;
}

export class UpdateTournamentFundByCreatorDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsEnum(FundStatus)
  status: FundStatus;

  @IsOptional()
  @IsString()
  errorMessage: string;
}
