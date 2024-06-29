import { ScoreType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateScoreDto {
  @IsNotEmpty()
  @IsNumber()
  teamWin: number;

  @IsNotEmpty()
  @IsEnum(ScoreType)
  type: ScoreType;
}
