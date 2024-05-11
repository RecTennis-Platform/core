import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AddRefereesTournamentDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
