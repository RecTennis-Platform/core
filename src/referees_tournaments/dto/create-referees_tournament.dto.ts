import { IsEmail, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateRefereesTournamentDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsInt()
  @IsNotEmpty()
  readonly tournamentId: number;
}
