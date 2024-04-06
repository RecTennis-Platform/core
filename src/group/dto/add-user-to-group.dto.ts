import { IsNotEmpty, IsString } from 'class-validator';

export class AddUser2GroupDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
