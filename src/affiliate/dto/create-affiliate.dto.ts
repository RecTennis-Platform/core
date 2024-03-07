import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateAffiliateDto {
  @IsNotEmpty()
  @IsString()
  readonly companyName: string;

  @IsNotEmpty()
  @IsString()
  readonly contactPersonName: string;

  @IsEmail()
  @IsNotEmpty()
  readonly email: string;

  @IsNotEmpty()
  @IsString()
  readonly website: string;

  @IsNotEmpty()
  @IsString()
  readonly taxNumber: string;

  @IsNotEmpty()
  @IsString()
  readonly description: string;

  @IsNotEmpty()
  @IsString()
  readonly phone: string;
}
