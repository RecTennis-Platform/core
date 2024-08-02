import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export enum ServiceType {
  TOURNAMENT = 'tournament',
  GROUP = 'group',
  ADVERTISEMENT = 'advertisement',
}

export enum ServiceLevel {
  BASIC = 'basic',
  ADVANCED = 'advanced',
}

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  config: string;

  @IsEnum(ServiceType)
  @IsNotEmpty()
  type?: ServiceType;

  @IsEnum(ServiceLevel)
  @IsNotEmpty()
  level?: ServiceLevel;
}
