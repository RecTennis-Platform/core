import { IsString } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  image?: string;

  @IsString()
  title?: string;

  @IsString()
  description?: string;

  @IsString()
  content?: string;
}
