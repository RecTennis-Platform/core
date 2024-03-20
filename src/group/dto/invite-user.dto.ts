import { IsArray, IsEmail, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class InviteUser2GroupDto {
  @IsInt()
  @IsNotEmpty()
  groupId: number;

  @IsNotEmpty()
  @IsArray()
  @IsEmail({}, { each: true })
  emails: string[];

  @IsNotEmpty()
  @IsString()
  hostName: string;
}
