import { Gender, ParticipantType, TournamentFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Custom validation decorators

export class CreateTournamentDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: 'Name is too short' })
  name: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'Description is too short' })
  description?: string;

  @IsNotEmpty()
  @IsString()
  contactPersonName: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Contact number is too short' })
  contactNumber: string;

  @IsNotEmpty()
  @IsString()
  @IsEmail()
  contactEmail: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  startDate?: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  endDate?: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  registrationDueDate?: Date = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

  @IsNotEmpty()
  @IsString()
  @MinLength(20, { message: 'Address is too short' })
  address: string;

  @IsNotEmpty()
  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @IsNotEmpty()
  @IsNumber()
  maxParticipants: number;

  @IsNotEmpty()
  @IsEnum(Gender)
  gender: Gender;

  @IsNotEmpty()
  @IsEnum(ParticipantType)
  participantType: ParticipantType;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  playersBornAfterDate?: Date = new Date(1990, 0, 1); // Default 1990/1/1

  @IsNotEmpty()
  @IsString()
  purchasedPackageId: string;
}
