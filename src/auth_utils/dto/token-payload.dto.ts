import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class TokenPayloadDto {
  @IsNumber()
  @IsNotEmpty()
  sub: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsNumber()
  iat?: number;

  @IsNumber()
  exp?: number;
}
