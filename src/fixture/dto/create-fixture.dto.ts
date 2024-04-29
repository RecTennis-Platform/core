import { TournamentFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class Group {
  @IsNotEmpty()
  @IsArray()
  groupMembers: string[];

  @IsNotEmpty()
  @IsNumber()
  numberOfProceeders: number;
}

export class CreateFixtureDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fixtureStartDate?: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fixtureEndDate?: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  @IsNotEmpty()
  @IsString()
  @MinLength(20, { message: 'Address is too short' })
  address: string;

  @IsNotEmpty()
  @IsString()
  matchesStartTime: string = '08:00:00';

  @IsNotEmpty()
  @IsString()
  matchesEndTime: string = '20:00:00';

  @IsNotEmpty()
  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @IsNotEmpty()
  @IsNumber()
  numberOfParticipants: number;

  @IsOptional()
  @IsNumber()
  numberOfGroups: number = 2;

  @IsOptional()
  @IsNumber()
  maxDuration: number = 30;

  @IsOptional()
  @IsNumber()
  breakDuration: number = 10;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => Group)
  groups: Group[];
}
