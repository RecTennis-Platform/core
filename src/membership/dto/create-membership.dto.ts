import { MemberRole } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMembershipDto {
  @IsInt()
  @IsNotEmpty()
  groupId: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.member;
}
