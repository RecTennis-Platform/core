import { IsNotEmpty, IsString } from 'class-validator';

export class StartSetDto {
  @IsNotEmpty()
  @IsString()
  teamServeId: string;
}
