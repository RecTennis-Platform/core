import { PartialType } from '@nestjs/mapped-types';
import { CreateAffiliateDto } from './create-affiliate.dto';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { AffiliateStatus } from '@prisma/client';

export class UpdateAffiliateDto extends PartialType(CreateAffiliateDto) {
  @IsString()
  @IsOptional()
  @IsEmail()
  readonly email?: string;

  @IsEnum(AffiliateStatus)
  @IsOptional()
  readonly status?: AffiliateStatus;
}
