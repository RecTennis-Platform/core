import { IsNotEmpty, IsString } from 'class-validator';

export class StartMatchDto {
  // @IsNotEmpty()
  @IsString()
  teamServeId?: string;
}
