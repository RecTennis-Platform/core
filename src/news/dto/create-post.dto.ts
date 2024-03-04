import { IsString } from 'class-validator';

export class CreatePostDto {
  @IsString()
  image: string;

  @IsString()
  title: string;

  @IsString()
  description?: string = '';

  @IsString()
  content: string;
}
