import { PartialType } from '@nestjs/mapped-types';
import { CreatePackagesServiceDto } from './create-packages_service.dto';

export class UpdatePackagesServiceDto extends PartialType(CreatePackagesServiceDto) {}
