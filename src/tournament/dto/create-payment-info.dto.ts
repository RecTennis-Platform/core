import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class Bank {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  branch: string;

  @IsNotEmpty()
  @IsString()
  account: string;

  @IsNotEmpty()
  @IsString()
  owner: string;
}

export class Payment {
  @IsNotEmpty()
  @IsString()
  method: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Bank)
  bank: Bank;
}

export class CreatePaymentInfoDto {
  @IsNotEmpty()
  @IsString()
  image: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  unit: string;

  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Payment)
  payment: Payment;
}
