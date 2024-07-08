import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateAdvertisementDto {
  @IsNotEmpty()
  @IsString()
  image: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  purchasedPackageId: string;
}
