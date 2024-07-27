import { UnitCurrency } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGroupFundDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @IsNotEmpty()
  dueDate: Date;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(UnitCurrency)
  @IsNotEmpty()
  unit: UnitCurrency;

  @IsString()
  @IsNotEmpty()
  paymentInfo: string;

  @IsString()
  @IsOptional()
  qrImage?: string;
}
