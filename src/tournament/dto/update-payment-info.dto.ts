import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class Bank {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  branch: string;

  @IsOptional()
  @IsString()
  account: string;

  @IsOptional()
  @IsString()
  owner: string;
}

export class Payment {
  @IsOptional()
  @IsString()
  type: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Bank)
  bank: Bank;
}

export class UpdatePaymentInfoDto {
  @IsOptional()
  @IsString()
  image: string;

  @IsOptional()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  unit: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Payment)
  payment: Payment;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  reminderDate: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate: Date;
}
