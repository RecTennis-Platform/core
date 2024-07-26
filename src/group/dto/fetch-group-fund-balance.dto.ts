import { UnitCurrency } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class FetchGroupFundBalanceDto {
  @IsEnum(UnitCurrency)
  @IsNotEmpty()
  unit: UnitCurrency;
}
