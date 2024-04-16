import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import {
  CreateApplyApplicantDto,
  CreateTournamentDto,
  PageOptionsTournamentDto,
} from './dto';
import {
  ParticipantType,
  RegistrationStatus,
  TournamentPhase,
  tournaments,
} from '@prisma/client';

@Injectable()
export class TournamentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}

  async getTournamentDetails(userId: number, tournamentId: number) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        message: 'Tournament not found',
        data: null,
      });
    }

    // Get purchased package info
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: tournament.purchasedPackageId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Purchased package not found',
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        message: 'Purchased package is expired',
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    const isCreator = purchasedPackage.userId === userId;

    // Parse the config field for each service in the services array
    const parsedServices = purchasedPackage.package.services.map((service) => {
      const config = JSON.parse(service.config);
      return {
        ...service,
        config: config,
      };
    });

    // Build response data
    delete tournament.purchasedPackageId;

    const response_data = {
      ...tournament,
      purchasedPackage: {
        id: purchasedPackage.id,
        name: purchasedPackage.package.name,
        services: parsedServices,
      },
      participants: 0,
      isCreator: isCreator,
    };

    return {
      message: 'Get tournament details successfully',
      data: response_data,
    };
  }

  async getMyTournaments(
    userId: number,
    pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
    // Get user's purchased packages
    const purchasedPackages =
      await this.mongodbPrismaService.purchasedPackage.findMany({
        where: {
          userId: userId,
          endDate: {
            lt: new Date(),
          },
        },
      });

    // Get purchased packages that have the "Tournament" service
    const filteredPurchasedPackages = purchasedPackages.filter(
      (purchasedPackage) =>
        purchasedPackage.package.services.some(
          (service) => service.name.toLowerCase() === 'tournament',
        ),
    );

    // Get purchased packages id
    const purchasedPackageIds = filteredPurchasedPackages.map(
      (purchasedPackage) => purchasedPackage.id,
    );

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsTournamentDto.order,
        },
      ],
      where: {
        purchasedPackageId: {
          in: purchasedPackageIds,
        },
      },
    };

    const pageOption =
      pageOptionsTournamentDto.page && pageOptionsTournamentDto.take
        ? {
            skip: pageOptionsTournamentDto.skip,
            take: pageOptionsTournamentDto.take,
          }
        : undefined;

    // Get tournaments that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournaments.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournaments.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsTournamentDto.take),
      totalCount,
    };
  }

  async createTournament(userId: number, dto: CreateTournamentDto) {
    // Get purchased package info
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: dto.purchasedPackageId,
          userId: userId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Purchased package not found',
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        message: 'Purchased package is expired',
        data: null,
      });
    }

    // Check if the Purchased package have the service == "Tournament"
    const tournamentService = purchasedPackage.package.services.find(
      (service) => service.name.toLowerCase() == 'tournament',
    );

    if (!tournamentService) {
      throw new BadRequestException({
        message: 'This package does not have the service to create tournament',
        data: null,
      });
    }

    // Check if the user has exceeded the allowed number of tournaments
    const count = await this.prismaService.tournaments.count({
      where: {
        purchasedPackageId: dto.purchasedPackageId,
      },
    });
    if (count >= JSON.parse(tournamentService.config).maxTournament) {
      throw new BadRequestException({
        message: 'Exceeded the allowed number of tournaments',
        data: null,
      });
    }

    // Check valid maxParticipants value
    if (!dto.maxParticipants) {
      dto.maxParticipants = JSON.parse(
        tournamentService.config,
      ).maxParticipants;
    } else if (
      dto.maxParticipants > JSON.parse(tournamentService.config).maxParticipants
    ) {
      throw new BadRequestException({
        message: 'Max participants exceeds the limit',
        data: null,
      });
    }

    try {
      // Create a new tournament
      const data: tournaments = await this.prismaService.tournaments.create({
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

      // Parse the config field for each service in the services array
      const parsedServices = purchasedPackage.package.services.map(
        (service) => {
          const config = JSON.parse(service.config);
          return {
            ...service,
            config: config,
          };
        },
      );

      // Build response data
      delete data.purchasedPackageId;
      const response_data = {
        ...data,
        // Populate purchasedPackage from MongoDB
        purchasedPackage: {
          id: purchasedPackage.id,
          name: purchasedPackage.package.name,
          services: parsedServices,
        },
        participants: 0,
        isCreator: true,
      };

      return {
        message: 'Tournament created successfully',
        data: response_data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to create tournament',
        data: null,
      });
    }
  }

  async publishTournament(userId: number, tournamentId: number) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        message: 'Tournament not found',
        data: null,
      });
    }

    // Get purchased package info
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: tournament.purchasedPackageId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Purchased package not found',
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        message: 'Purchased package is expired',
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (purchasedPackage.userId !== userId) {
      throw new BadRequestException({
        message: 'Unauthorized to publish this tournament',
        data: null,
      });
    }

    // Update tournament status
    try {
      await this.prismaService.tournaments.update({
        where: {
          id: tournamentId,
        },
        data: {
          phase: TournamentPhase.published,
        },
      });

      return {
        message: 'Tournament published successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to create tournament',
        data: null,
      });
    }
  }

  // Participants
  // Creator

  // Applicant
  async submitApplication(
    userId: number,
    tournamentId: number,
    dto: CreateApplyApplicantDto,
  ) {
    // Check if tournament exists
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        message: 'Tournament not found',
        data: null,
      });
    }

    // Get purchased package info
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: tournament.purchasedPackageId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Purchased package not found',
        data: null,
      });
    }

    // Check if the purchased package expired
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        message: 'Purchased package is expired',
        data: null,
      });
    }

    // Check max participants
    const participantsCount =
      await this.getTournamentParticipantsCount(tournamentId);
    if (participantsCount >= tournament.maxParticipants) {
      throw new BadRequestException({
        message: 'Exceeded the maximum number of participants',
        data: null,
      });
    }

    // Check the tournament format (single, doubles, mix doubles; male, female)
    const user1 = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user1) {
      throw new UnauthorizedException({
        message: 'Unauthorized',
        data: null,
      });
    }

    // Singles
    let user2 = null;
    let tournament_registration_status = 'pending';
    let appliedDate = null;
    if (tournament.participantType === ParticipantType.singles) {
      // Check if user has already applied
      const existingRegistration =
        await this.prismaService.tournament_registrations.findFirst({
          where: {
            tournamentId: tournamentId,
            userId1: userId,
          },
        });

      if (existingRegistration) {
        throw new BadRequestException({
          message: 'User has already applied for this tournament',
          data: null,
        });
      }

      // Check tournament participant type gender
      if (user1.gender !== tournament.gender) {
        throw new BadRequestException({
          message: 'Invalid applicant gender',
          data: null,
        });
      }

      appliedDate = new Date();
    } else {
      // Doubles or Mix doubles
      // user2Email required
      if (!dto.user2Email) {
        throw new BadRequestException({
          message: `User2's email required`,
          data: null,
        });
      }

      const user2Res = await this.prismaService.users.findUnique({
        where: {
          email: dto.user2Email,
        },
      });

      if (!user2Res) {
        throw new NotFoundException({
          message: `Could not find user with email ${dto.user2Email}`,
          data: null,
        });
      }

      // Check if the user2 is the same as user1
      if (userId === user2Res.id) {
        throw new BadRequestException({
          message: 'User cannot apply to the tournament with themselves',
          data: null,
        });
      }

      // Check if user has already applied
      const existingRegistration =
        await this.prismaService.tournament_registrations.findFirst({
          where: {
            tournamentId: tournamentId,
            userId1: userId,
            userId2: user2Res.id,
          },
        });

      if (
        existingRegistration &&
        existingRegistration.status !== RegistrationStatus.canceled
      ) {
        throw new BadRequestException({
          message: 'User has already applied for this tournament',
          data: null,
        });
      }

      if (tournament.participantType === ParticipantType.mixed_doubles) {
        if (user1.gender === user2Res.gender) {
          throw new BadRequestException({
            message: 'Invalid applicants gender',
            data: null,
          });
        }
      } else {
        if (
          user1.gender !== tournament.gender ||
          user2Res.gender !== tournament.gender
        ) {
          throw new BadRequestException({
            message: 'Invalid applicants gender',
            data: null,
          });
        }
      }
      user2 = user2Res;
      tournament_registration_status = 'inviting';
    }

    let userId2 = null;
    if (user2) {
      userId2 = user2.id;
    }

    // Create tournament registration
    const tournament_registration =
      await this.prismaService.tournament_registrations.create({
        data: {
          tournamentId: tournamentId,
          userId1: userId,
          userId2: userId2,
          name: dto.name || user1.name,
          message: dto.message,
          status: RegistrationStatus[tournament_registration_status],
          appliedDate: appliedDate,
        },
      });

    let response_data = {};
    if (tournament.participantType === ParticipantType.singles) {
      // Build response data
      response_data = {
        user1: {
          id: user1.id,
          name: user1.name,
          image: user1.image,
          email: user1.email,
          gender: user1.gender,
        },
        message: tournament_registration.message,
        status: tournament_registration.status,
        appliedDate: tournament_registration.appliedDate,
      };
    } else {
      // Build response data
      response_data = {
        user1: {
          id: user1.id,
          name: user1.name,
          image: user1.image,
          email: user1.email,
          gender: user1.gender,
        },
        user2: {
          id: user2.id,
          name: user2.name,
          image: user2.image,
          email: user2.email,
          gender: user2.gender,
        },
        message: tournament_registration.message,
        status: tournament_registration.status,
      };

      // Cancell all invitations to user1
      await this.prismaService.tournament_registrations.updateMany({
        where: {
          userId2: userId,
          status: RegistrationStatus.inviting,
        },
        data: {
          status: RegistrationStatus.canceled,
        },
      });
    }

    return {
      message: 'Tournament published successfully',
      data: response_data,
    };
  }

  // Utils
  async getTournamentParticipantsCount(tournamentId: number) {
    return await this.prismaService.tournament_registrations.count({
      where: {
        tournamentId: tournamentId,
      },
    });
  }
}
