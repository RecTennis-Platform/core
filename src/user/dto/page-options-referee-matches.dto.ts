import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class PageOptionsRefereeMatchesDto {
  @IsString()
  @IsOptional()
  readonly status?: MatchStatus;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly groupId: number;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
