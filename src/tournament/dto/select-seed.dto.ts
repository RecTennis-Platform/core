import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SelectSeedDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsNumber()
  seed: number;
}
