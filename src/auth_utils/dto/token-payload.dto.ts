import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';

export class TokenPayloadDto {
  @IsNumber()
  @IsNotEmpty()
  sub: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumber()
  iat?: number;

  @IsNumber()
  exp?: number;

  @IsNumber()
  groupId?: number;
}
