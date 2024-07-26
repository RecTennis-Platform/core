import { ExpenseType } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class FetchGroupExpensesDto {
  @IsEnum(ExpenseType)
  @IsOptional()
  type?: ExpenseType;

  @IsNumber()
  @IsNotEmpty()
  fundId: number;

  @IsDate()
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @IsOptional()
  endDate?: Date;
}
