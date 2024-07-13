import { MatchStatus } from '@prisma/client';
import {
  IsOptional,
  IsString,
  IsInt,
  IsDate,
  IsDateString,
  IsEnum,
} from 'class-validator';

export class UpdateMatchDto {
  @IsOptional()
  @IsString()
  groupFixtureTeamId1?: string;

  @IsOptional()
  @IsString()
  groupFixtureTeamId2?: string;

  @IsOptional()
  @IsInt()
  rankGroupTeam1?: number;

  @IsOptional()
  @IsInt()
  rankGroupTeam2?: number;

  @IsOptional()
  @IsString()
  teamId1?: string;

  @IsOptional()
  @IsString()
  teamId2?: string;

  @IsOptional()
  @IsString()
  teamWinnerId?: string;

  @IsOptional()
  @IsDateString()
  matchStartDate?: Date;

  @IsOptional()
  @IsDateString()
  matchEndDate?: Date;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsInt()
  breakDuration?: number;

  @IsOptional()
  @IsString()
  nextMatchId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  refereeId?: string;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsInt()
  team1MatchScore?: number;

  @IsOptional()
  @IsInt()
  team2MatchScore?: number;
}
