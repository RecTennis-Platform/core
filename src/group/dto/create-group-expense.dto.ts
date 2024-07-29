import { ExpenseType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGroupExpenseDto {
  @IsEnum(ExpenseType)
  @IsNotEmpty()
  type: ExpenseType;

  @IsArray()
  @IsNotEmpty()
  categories: string[];

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}
