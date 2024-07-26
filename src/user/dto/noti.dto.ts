import { Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Order } from 'constants/order';

export class UpdateNotitDto {
  @IsArray()
  @IsNotEmpty() // Ensures the array is not empty
  @IsString({ each: true }) // Validates that each element in the array is a string
  notiListId: string[];
}

export class PageOptionsNotificationDto {
  @IsBoolean()
  @IsOptional()
  readonly isRead?: boolean;

  @IsEnum(Order)
  @IsOptional()
  readonly order?: Order = Order.DESC;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  @IsOptional()
  readonly take?: number = 5;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
