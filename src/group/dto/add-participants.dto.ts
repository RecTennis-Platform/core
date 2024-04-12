import { ArrayMinSize, IsArray, IsNotEmpty } from 'class-validator';

export class AddParticipantsDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  userIds: number[];
}
