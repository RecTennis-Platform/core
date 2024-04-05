import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchasedPackageDto } from './create-purchased_package.dto';

export class UpdatePurchasedPackageDto extends PartialType(
  CreatePurchasedPackageDto,
) {}
