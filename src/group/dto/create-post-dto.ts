import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  image?: string;

  @IsNotEmpty()
  @IsString()
  content: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
