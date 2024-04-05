import { Optional } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreatePackageDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsString()
  readonly description: string;

  @IsNotEmpty()
  @IsNumber()
  readonly price: number;

  @IsNotEmpty()
  @IsNumber()
  readonly duration: number;

  @Optional()
  readonly images: string[];

  @IsNotEmpty()
  @IsArray()
  readonly features: string[];

  @IsNotEmpty()
  @IsNumber({}, { each: true })
  readonly services: number[];
}
