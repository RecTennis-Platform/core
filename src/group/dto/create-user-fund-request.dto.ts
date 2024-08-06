import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateUserFundRequestDto {
  @IsNumber()
  @IsNotEmpty()
  fundId: number;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
