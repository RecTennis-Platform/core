import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  boughtPackageId: string;

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
