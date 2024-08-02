import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PageOptionsPackageDto } from './dto/page-options-package.dto';

@Controller('packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  async create(@Body() createPackageDto: CreatePackageDto) {
    try {
      return await this.packageService.create(createPackageDto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll(@Query() dto: PageOptionsPackageDto) {
    try {
      return await this.packageService.findAll(dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin')
  async findAllAdmin(@Query() pageOptions: PageOptionsPackageDto) {
    try {
      return await this.packageService.findAllAdmin(pageOptions);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.packageService.findOne(+id);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('upgrade/:id')
  async findUpgradePackages(@Param('id') id: number) {
    try {
      return await this.packageService.getAllParents(+id);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePackageDto: UpdatePackageDto,
  ) {
    try {
      return await this.packageService.update(+id, updatePackageDto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.packageService.remove(+id);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly packageService: PackageService) {}

  @Get()
  async findAll() {
    try {
      return {
        services: [
          {
            id: '1',
            name: 'Group Management',
            description:
              'Manage Every Aspect Of Your Group, Sports Organization, Association & Federation.',
            path: 'groups',
          },
          {
            id: '2',
            name: 'Tournament',
            description:
              'Manage Participants, Generate Schedules & Score Matches While Keeping Track Of Scores & Statistics.',
            path: 'tournaments',
          },
          {
            id: '3',
            name: 'Affiliate',
            description:
              'Create advertisements to promote affiliated products or services.',
            path: 'affiliates',
          },
        ],
        openTournament: {
          format: ['round_robin', 'knock_out', 'group_playoff'],
          gender: ['male', 'female', 'any'],
          participantType: ['single', 'double', 'mixed_doubles'],
        },
        groupTournament: {
          format: ['round_robin', 'knock_out'],
          gender: ['male', 'female', 'any'],
          participantType: ['single'],
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
