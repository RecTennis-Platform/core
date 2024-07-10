import { AdvertisementStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAdvertisementDto {
  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(AdvertisementStatus)
  status?: AdvertisementStatus;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  website?: string;
}
