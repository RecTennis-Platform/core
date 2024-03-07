import { PartialType } from '@nestjs/mapped-types';
import { CreateAffiliateDto } from './create-affiliate.dto';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateAffiliateDto extends PartialType(CreateAffiliateDto) {
  @IsString()
  @IsOptional()
  @IsEmail()
  readonly email?: string;
}
