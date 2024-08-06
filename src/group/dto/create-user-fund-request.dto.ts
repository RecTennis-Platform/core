import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateUserFundRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
