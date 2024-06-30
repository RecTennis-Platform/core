import { FixtureStatus, MatchStatus, TournamentFormat } from '@prisma/client';
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
  teams: string[];

  @IsNotEmpty()
  @IsNumber()
  numberOfProceeders: number;

  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  title: string;
}

export class GenerateFixtureDto {
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
  @MinLength(5, { message: 'Venue is too short' })
  venue: string;

  @IsNotEmpty()
  @IsString()
  matchesStartTime: string = '08:00:00';

  @IsNotEmpty()
  @IsString()
  matchesEndTime: string = '20:00:00';

  // @IsNotEmpty()
  // @IsEnum(TournamentFormat)
  // format: TournamentFormat;

  @IsOptional()
  @IsNumber()
  matchDuration: number = 30;

  @IsOptional()
  @IsNumber()
  breakDuration: number = 10;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => Group)
  groups: Group[];
}

export class GenerateFixtureKnockoutDto {
  // @IsOptional()
  // @IsDate()
  // @Type(() => Date)
  // fixtureStartDate?: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // @IsOptional()
  // @IsDate()
  // @Type(() => Date)
  // fixtureEndDate?: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // @IsNotEmpty()
  // @IsString()
  // @MinLength(5, { message: 'Venue is too short' })
  // venue: string;

  // @IsNotEmpty()
  // @IsString()
  // matchesStartTime: string = '08:00:00';

  // @IsNotEmpty()
  // @IsString()
  // matchesEndTime: string = '20:00:00';

  // @IsNotEmpty()
  // @IsEnum(TournamentFormat)
  // format: TournamentFormat;

  // @IsOptional()
  // @IsNumber()
  // matchDuration: number = 30;

  // @IsOptional()
  // @IsNumber()
  // breakDuration: number = 10;

  @IsNotEmpty()
  @IsNumber()
  numberOfProceeders: number;
}

export class Team {
  @IsOptional()
  @IsString()
  id: string;
}

export class Teams {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Team)
  team1: Team;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Team)
  team2: Team;
}

export class Match {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  nextMatchId?: string = null;

  @IsOptional()
  @IsString()
  refereeId: string = null;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  matchStartDate: Date;

  @IsNotEmpty()
  @IsEnum(MatchStatus)
  status: MatchStatus;

  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Teams)
  teams: Teams;

  @IsOptional()
  @IsString()
  groupFixtureTeamId1: string = null;

  @IsOptional()
  @IsString()
  groupFixtureTeamId2: string = null;

  @IsOptional()
  @IsNumber()
  rankGroupTeam1: number = null;

  @IsOptional()
  @IsNumber()
  rankGroupTeam2: number = null;

  @IsOptional()
  @IsString()
  venue: string;

  @IsOptional()
  @IsNumber()
  duration: number = 30;
}

export class Round {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => Match)
  matches: Match[];
}

export class GroupFixture {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  numberOfProceeders = 1;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => Round)
  rounds: Round[];
}

export class CreateFixtureDto {
  @IsNotEmpty()
  @IsString()
  id: string;

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
  @MinLength(5, { message: 'Venue is too short' })
  venue: string;

  @IsNotEmpty()
  @IsString()
  matchesStartTime: string = '08:00:00';

  @IsNotEmpty()
  @IsString()
  matchesEndTime: string = '20:00:00';

  // @IsNotEmpty()
  // @IsEnum(TournamentFormat)
  // format: TournamentFormat;

  @IsOptional()
  @IsNumber()
  numberOfGroups: number = 2;

  @IsOptional()
  @IsNumber()
  matchDuration: number = 30;

  @IsOptional()
  @IsNumber()
  breakDuration: number = 10;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GroupFixture)
  roundRobinGroups?: GroupFixture[] = [];

  @IsOptional()
  @ValidateNested()
  @Type(() => GroupFixture)
  knockoutGroup: GroupFixture;

  @IsOptional()
  @IsEnum(FixtureStatus)
  status: FixtureStatus;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => Group)
  groups: Group[];
}
