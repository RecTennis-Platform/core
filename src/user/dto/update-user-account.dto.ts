import { IsOptional, IsString } from 'class-validator';

export class UpdateUserAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  image?: string;
}
