import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateFixtureGroupPlayoffDto {
  @IsNotEmpty()
  @IsNumber()
  numberOfGroups: number = 2;
}
