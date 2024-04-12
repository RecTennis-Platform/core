import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';

@Injectable()
export class TournamentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}

  async createTournament(userId: number, dto: CreateTournamentDto) {
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: dto.purchasedPackageId,
          userId: userId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Bought package not found',
        data: null,
      });
    }

    if (purchasedPackage.expired) {
      throw new BadRequestException({
        message: 'Bought package is expired',
        data: null,
      });
    }

    // Check if the bought package have the service == "Tournament"

    const TournamentService = purchasedPackage.package.services.find(
      (service) => service.name.toLowerCase() == 'tournament',
    );

    if (!TournamentService) {
      throw new BadRequestException({
        message: 'This package does not have the service to create tournament',
        data: null,
      });
    }

    const count = await this.prismaService.tournaments.count({
      where: {
        purchasedPackageId: dto.purchasedPackageId,
      },
    });
    if (count >= JSON.parse(TournamentService.config).maxTournament) {
      throw new BadRequestException({
        message: 'Exceeded the allowed number of tournaments',
        data: null,
      });
    }

    try {
      // Create a new tournament
      const data = await this.prismaService.tournaments.create({
        data: {
          purchasedPackageId: dto.purchasedPackageId,
          name: dto.name,
          maxParticipants: dto.maxParticipants,
          gender: dto.gender,
          format: dto.format,
          participantType: dto.participantType,
          image: dto.image,
          description: dto.description,
          playersBornAfterDate: dto.playersBornAfterDate,
          registrationDueDate: dto.registrationDueDate,
          startDate: dto.startDate,
          endDate: dto.endDate,
          address: dto.address,
          contactPersonName: dto.contactPersonName,
          contactNumber: dto.contactNumber,
          contactEmail: dto.contactEmail,
        },
      });

      // Update purchased service
      const newServices = purchasedPackage.package.services.map((service) => {
        if (service.name.toLowerCase() == 'tournament') {
          const serviceConfig = JSON.parse(service.config);
          serviceConfig.used += 1;
          service.config = JSON.stringify(serviceConfig);
        }
        return service;
      });
      purchasedPackage.package.services = newServices;

      await this.mongodbPrismaService.purchasedPackage.update({
        where: {
          id: purchasedPackage.id,
        },
        data: {
          package: purchasedPackage.package,
        },
      });

      // Populate purchasedPackage
      data['purchasedPackage'] = {
        id: purchasedPackage.id,
        name: purchasedPackage.package.name,
        services: purchasedPackage.package.services,
      };
      delete data.purchasedPackageId;

      // TODO: Populate participants

      return {
        message: 'Tournament created successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to create tournament',
        data: null,
      });
    }
  }
}
