import { IsEmail, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class InviteUser2GroupDto {
  @IsInt()
  @IsNotEmpty()
  groupId: number;

  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  hostName: string;
}
