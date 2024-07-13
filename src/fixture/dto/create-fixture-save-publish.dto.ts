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
  @ValidateNested({ each: true })
  teams: string[];

  @IsOptional()
  @IsNumber()
  numberOfProceeders: number = 1;

  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  title: string;
}

export class Team {
  @IsNotEmpty()
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

  @IsNotEmpty()
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

  @IsNotEmpty()
  @IsString()
  venue: string;

  @IsNotEmpty()
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

  @IsNotEmpty()
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

  @IsNotEmpty()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => Round)
  rounds: Round[];
}

export class CreateFixturePublishDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  fixtureStartDate?: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  @IsNotEmpty()
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

  @IsNotEmpty()
  @IsNumber()
  numberOfGroups: number = 2;

  @IsNotEmpty()
  @IsNumber()
  matchDuration: number = 30;

  @IsNotEmpty()
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

  @IsOptional()
  @IsNumber()
  numberOfKnockoutTeams: number;
}

export class CreateFixturePublishKnockoutDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GroupFixture)
  knockoutGroup: GroupFixture;
}
