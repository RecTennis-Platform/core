import { ExpenseType, UnitCurrency } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGroupExpenseDto {
  @IsNumber()
  @IsNotEmpty()
  fundId: number;

  @IsEnum(ExpenseType)
  @IsNotEmpty()
  type: ExpenseType;

  @IsArray()
  @IsNotEmpty()
  categories: string[];

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(UnitCurrency)
  @IsNotEmpty()
  unit: UnitCurrency;

  @IsString()
  @IsOptional()
  description?: string;
}
