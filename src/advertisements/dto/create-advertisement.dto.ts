import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAdvertisementDto {
  @IsNotEmpty()
  @IsString()
  image: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  website: string;

  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  purchasedPackageId: string;
}
