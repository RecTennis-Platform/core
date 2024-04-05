import { GroupStatus, MemberRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Order } from 'constants/order';

export class PageOptionsGroupDto {
  @IsEnum(Order)
  @IsOptional()
  order?: Order = Order.DESC;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  take?: number;

  @IsEnum(GroupStatus)
  @IsOptional()
  status?: GroupStatus;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}

export class PageOptionsGroupMembershipDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  take?: number;

  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
