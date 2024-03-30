import { PartialType } from '@nestjs/mapped-types';
import { CreateBoughtPackageDto } from './create-bought_package.dto';

export class UpdateBoughtPackageDto extends PartialType(CreateBoughtPackageDto) {}
