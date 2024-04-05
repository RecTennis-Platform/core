import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  purchasedPackageId: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  activityZone?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
