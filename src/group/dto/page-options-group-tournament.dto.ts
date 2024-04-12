import { IsEnum, IsOptional } from 'class-validator';
import { Order } from '../../../constants/order';

export class PageOptionsGroupTournamentDto {
  @IsEnum(Order)
  @IsOptional()
  order?: Order = Order.DESC;
}
