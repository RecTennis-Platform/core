import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsInt()
  @IsNotEmpty()
  packageId: number;

  @IsString()
  @IsOptional()
  name?: string;

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
