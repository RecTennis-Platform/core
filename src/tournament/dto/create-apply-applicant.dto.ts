import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateApplyApplicantDto {
  @IsEmail()
  @IsOptional()
  user2Email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsString()
  message: string;
}
