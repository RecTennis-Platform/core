import { Optional } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';

export enum PackageType {
  TOURNAMENT = 'tournament',
  GROUP = 'group',
  AFFILIATE = 'affiliate',
}

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

  @IsEnum(PackageType)
  @IsNotEmpty()
  type?: PackageType;
}
