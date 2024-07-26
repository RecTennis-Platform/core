import { GroupFundStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class ConfirmGroupFundRequestDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsEnum(GroupFundStatus)
  @IsNotEmpty()
  status: GroupFundStatus;
}
