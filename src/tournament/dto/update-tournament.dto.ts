import { Gender, ParticipantType, TournamentFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Name is too short' })
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'Description is too short' })
  description?: string;

  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Contact number is too short' })
  contactNumber?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  registrationDueDate?: Date;

  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'Address is too short' })
  address?: string;

  @IsOptional()
  @IsEnum(TournamentFormat)
  format?: TournamentFormat;

  @IsOptional()
  @IsNumber()
  maxParticipants?: number;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(ParticipantType)
  participantType?: ParticipantType;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  playersBornAfterDate?: Date;
}
