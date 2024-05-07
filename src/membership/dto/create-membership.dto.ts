import { MemberRole } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateMembershipDto {
  @IsInt()
  @IsNotEmpty()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.member;
}
