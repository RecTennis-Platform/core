import { PartialType } from '@nestjs/mapped-types';
import { GenerateFixtureDto } from './create-fixture.dto';

export class UpdateFixtureDto extends PartialType(GenerateFixtureDto) {}
