import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';

export class TokenPayloadDto {
  @IsNumber()
  @IsNotEmpty()
  sub: number;

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
