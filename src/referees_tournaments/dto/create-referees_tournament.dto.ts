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

export class CreateRefereesGroupTournamentDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsInt()
  @IsNotEmpty()
  readonly groupTournamentId: number;
}
