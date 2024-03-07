import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMiniAppDataDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  iosBundleUrl: string;

  @IsString()
  @IsNotEmpty()
  androidBundleUrl: string;

  @IsString()
  @IsNotEmpty()
  level: number;
}
