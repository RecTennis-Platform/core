import { PartialType } from '@nestjs/mapped-types';
import { CreateRefereesTournamentDto } from './create-referees_tournament.dto';

export class UpdateRefereesTournamentDto extends PartialType(CreateRefereesTournamentDto) {}
