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
  MatchStatus,
  ParticipantType,
  Prisma,
  RegistrationStatus,
  TournamentFormat,
  TournamentPhase,
  tournaments,
} from '@prisma/client';
import { FormatTournamentService } from 'src/services/format_tournament/format_tournament.service';
import {
  CreateFixtureDto,
  GenerateFixtureDto,
} from 'src/fixture/dto/create-fixture.dto';
import { randomUUID } from 'crypto';
import { CreateFixtureGroupPlayoffDto } from 'src/fixture/dto/create-fixture-groupplayoff.dto';

@Injectable()
export class TournamentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
    private readonly formatTournamentService: FormatTournamentService,
  ) {}

  async getTournamentsList(pageOptionsTournamentDto: PageOptionsTournamentDto) {
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsTournamentDto.order,
        },
      ],
    };

    const pageOption =
      pageOptionsTournamentDto.page && pageOptionsTournamentDto.take
        ? {
            skip: pageOptionsTournamentDto.skip,
            take: pageOptionsTournamentDto.take,
          }
        : undefined;

    // Get all tournaments
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournaments.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournaments.count({}),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsTournamentDto.take),
      totalCount,
    };
  }

  // For normal usage
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
  async getApplicantsList(
    userId: number,
    tournamentId: number,
    pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
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
      throw new UnauthorizedException({
        message: 'Unauthorized to access this tournament',
        data: null,
      });
    }

    let projection = {};
    if (tournament.participantType === ParticipantType.singles) {
      projection = {
        userId1: true,
        message: true,
        status: true,
        appliedDate: true,
      };
    } else {
      projection = {
        userId1: true,
        userId2: true,
        message: true,
        status: true,
        appliedDate: true,
      };
    }

    // Get list of tournament applicants
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsTournamentDto.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
      },
      select: {
        ...projection,
      },
    };

    if (pageOptionsTournamentDto.status) {
      conditions.where['status'] = pageOptionsTournamentDto.status;
    }

    const pageOption =
      pageOptionsTournamentDto.page && pageOptionsTournamentDto.take
        ? {
            skip: pageOptionsTournamentDto.skip,
            take: pageOptionsTournamentDto.take,
          }
        : undefined;

    // Get tournaments that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournament_registrations.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    return {
      data: result,
      participantType: tournament.participantType,
      maxParticipants: tournament.maxParticipants,
      totalPages: Math.ceil(totalCount / pageOptionsTournamentDto.take),
      totalCount,
    };
  }

  async approveApplicant(
    tournamentId: number,
    userId: number,
    applicantId: number,
  ) {
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
      throw new UnauthorizedException({
        message: 'Unauthorized to access this tournament',
        data: null,
      });
    }

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          tournamentId: tournamentId,
          userId1: applicantId,
          status: RegistrationStatus.pending,
        },
      });

    if (!tournament_registration) {
      throw new NotFoundException({
        message: 'Applicant not found',
        data: null,
      });
    }

    // Update tournament registration status -> approved
    try {
      await this.prismaService.tournament_registrations.update({
        where: {
          id: tournament_registration.id,
        },
        data: {
          status: RegistrationStatus.approved,
        },
      });
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        message: 'Failed to approve the applicant',
        data: null,
      });
    }

    return {
      message: 'Applicant approved successfully',
      data: null,
    };
  }

  async rejectApplicant(
    tournamentId: number,
    userId: number,
    applicantId: number,
  ) {
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
      throw new UnauthorizedException({
        message: 'Unauthorized to access this tournament',
        data: null,
      });
    }

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          tournamentId: tournamentId,
          userId1: applicantId,
          status: RegistrationStatus.pending,
        },
      });

    if (!tournament_registration) {
      throw new NotFoundException({
        message: 'Applicant not found',
        data: null,
      });
    }

    // Update tournament registration status -> rejected
    try {
      await this.prismaService.tournament_registrations.update({
        where: {
          id: tournament_registration.id,
        },
        data: {
          status: RegistrationStatus.rejected,
        },
      });
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        message: 'Failed to reject the applicant',
        data: null,
      });
    }

    return {
      message: 'Applicant rejected successfully',
      data: null,
    };
  }

  async finalizeApplicantList(tournamentId: number, userId: number) {
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
      throw new UnauthorizedException({
        message: 'Unauthorized to access this tournament',
        data: null,
      });
    }

    // Check if the tournament status is already finalized_applicants
    if (tournament.phase === TournamentPhase.finalized_applicants) {
      return {
        message: 'Applicant list already finalized',
        data: null,
      };
    }

    // Update tournament status -> finalized_applicants
    try {
      await this.prismaService.tournaments.update({
        where: {
          id: tournamentId,
        },
        data: {
          phase: TournamentPhase.finalized_applicants,
        },
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to finalize the applicant list',
        data: null,
      });
    }

    return {
      message: 'Applicant list finalized successfully',
      data: null,
    };
  }

  async getTournamentParticipants(
    tournamentId: number,
    pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
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

    // Check if the tournament status is finalized_applicants
    if (tournament.phase !== TournamentPhase.finalized_applicants) {
      return {
        message: 'Applicants list not finalized',
        data: null,
      };
    }

    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsTournamentDto.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
        status: RegistrationStatus.approved,
      },
    };

    if (tournament.participantType === ParticipantType.singles) {
      conditions['select'] = {
        userId1: true,
        message: true,
        status: true,
        appliedDate: true,
      };
    } else {
      conditions['select'] = {
        userId1: true,
        userId2: true,
        message: true,
        status: true,
        appliedDate: true,
      };
    }

    const pageOption =
      pageOptionsTournamentDto.page && pageOptionsTournamentDto.take
        ? {
            skip: pageOptionsTournamentDto.skip,
            take: pageOptionsTournamentDto.take,
          }
        : undefined;

    // Get finalized applicants
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournament_registrations.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    return {
      data: result,
      participantType: tournament.participantType,
      maxParticipants: tournament.maxParticipants,
      totalPages: Math.ceil(totalCount / pageOptionsTournamentDto.take),
      totalCount,
    };
  }

  // Applicant
  async getSubmittedApplications(userId: number, tournamentId: number) {
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

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          tournamentId: tournamentId,
          userId1: userId,
        },
      });

    if (!tournament_registration) {
      return {
        message: 'No submitted applications',
        data: null,
      };
    }

    // Get user1 info
    const user1 = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user1) {
      throw new NotFoundException({
        message: 'User1 not found',
        data: null,
      });
    }

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
      // Check if the invitation is accepted
      if (
        tournament_registration.status !== RegistrationStatus.pending &&
        tournament_registration.status !== RegistrationStatus.inviting
      ) {
        return {
          message: 'Invalid submitted application',
          data: null,
        };
      }

      // Get user2 info
      const user2 = await this.prismaService.users.findUnique({
        where: {
          id: tournament_registration.userId2,
        },
      });

      if (!user2) {
        throw new NotFoundException({
          message: 'User2 not found',
          data: null,
        });
      }

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
        appliedDate: tournament_registration.appliedDate,
      };
    }

    return {
      message: 'Get submitted applications successfully',
      data: response_data,
    };
  }

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
      await this.cancelAllTournamentInvitations(userId, tournamentId);
    }

    return {
      message: 'Tournament published successfully',
      data: response_data,
    };
  }

  async cancelApplication(userId: number, tournamentId: number) {
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

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          tournamentId: tournamentId,
          OR: [
            {
              userId1: userId,
            },
            {
              userId2: userId,
            },
          ],
        },
      });

    if (!tournament_registration) {
      return {
        message: 'No submitted applications',
        data: null,
      };
    }

    // Check application status
    if (
      !['inviting', 'pending'].includes(
        tournament_registration.status.toString(),
      )
    ) {
      return {
        message:
          'Cannot cancel the tournament application after admin approval',
        data: null,
      };
    }

    // Update tournament registration status
    try {
      await this.prismaService.tournament_registrations.update({
        where: {
          id: tournament_registration.id,
        },
        data: {
          status: RegistrationStatus.canceled,
        },
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to cancel the tournament application',
        data: null,
      });
    }

    return {
      message: 'Tournament application canceled successfully',
      data: null,
    };
  }

  async getTournamentInvitations(
    userId: number,
    tournamentId: number,
    pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
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

    // Get list of tournament invitations
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsTournamentDto.order,
        },
      ],
      where: {
        userId2: userId,
        status: RegistrationStatus.inviting,
      },
      select: {
        userId1: true,
        userId2: true,
        message: true,
        status: true,
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
      this.prismaService.tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournament_registrations.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsTournamentDto.take),
      totalCount,
    };
  }

  async acceptInvitation(
    userId: number,
    tournamentId: number,
    inviterId: number,
  ) {
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

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          id: inviterId,
          status: RegistrationStatus.inviting,
        },
      });

    if (!tournament_registration) {
      throw new NotFoundException({
        message: 'Invitation not found',
        data: null,
      });
    }

    // Update tournament registration status -> pending
    try {
      await this.prismaService.tournament_registrations.update({
        where: {
          id: inviterId,
        },
        data: {
          status: RegistrationStatus.pending,
        },
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to accept the tournament invitation',
        data: null,
      });
    }

    // Cancel all invitation
    await this.cancelAllTournamentInvitations(userId, tournamentId);

    return {
      message: 'Invitation accepted successfully',
      data: null,
    };
  }

  async rejectInvitation(
    userId: number,
    tournamentId: number,
    inviterId: number,
  ) {
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

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          id: inviterId,
          status: RegistrationStatus.inviting,
        },
      });

    if (!tournament_registration) {
      throw new NotFoundException({
        message: 'Invitation not found',
        data: null,
      });
    }

    // Update tournament registration status -> canceled
    try {
      await this.prismaService.tournament_registrations.update({
        where: {
          id: inviterId,
        },
        data: {
          status: RegistrationStatus.canceled,
        },
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to cancel the tournament invitation',
        data: null,
      });
    }

    return {
      message: 'Invitation canceled successfully',
      data: null,
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

  async cancelAllTournamentInvitations(userId: number, tournamentId: number) {
    await this.prismaService.tournament_registrations.updateMany({
      where: {
        userId2: userId,
        tournamentId: tournamentId,
        status: RegistrationStatus.inviting,
      },
      data: {
        status: RegistrationStatus.canceled,
      },
    });
  }

  async generateFixtureGroup(id: number, dto: CreateFixtureGroupPlayoffDto) {
    const teams = await this.prismaService.teams.findMany({
      where: {
        tournamentId: id,
      },
      orderBy: {
        totalElo: Prisma.SortOrder.desc,
      },
      include: {
        user1: {
          select: {
            id: true,
            image: true,
            name: true,
          },
        },
        user2: {
          select: {
            id: true,
            image: true,
            name: true,
          },
        },
      },
    });

  //   const groups = this.formatTournamentService
  //     .generateGroupPlayOffPhase1(teams.length, dto.numberOfGroups)
  //     .map((group) => {
  //       return group.map((member) => {
  //         return teams[member - 1];
  //       });
  //     });
  //   return groups;
  // }

  async generateFixture(id: number, dto: GenerateFixtureDto) {
    try {
      if (
        dto.format === TournamentFormat.round_robin ||
        dto.format === TournamentFormat.knockout
      ) {
        const teams = await this.prismaService.teams.findMany({
          where: {
            tournamentId: id,
          },
          orderBy: {
            totalElo: Prisma.SortOrder.desc,
          },
          include: {
            user1: {
              select: {
                id: true,
                image: true,
                name: true,
              },
            },
            user2: {
              select: {
                id: true,
                image: true,
                name: true,
              },
            },
            tournaments: true,
          },
        });
        const rounds = [];
        if (dto.format === TournamentFormat.round_robin) {
          const tables = this.formatTournamentService.generateTables(
            dto.format,
            1,
            teams.length,
          );
          for (let i = 0; i < tables.table1.length; i++) {
            const matches = [];
            for (let j = 0; j < tables.table1[i].length; j++) {
              const team1 = {
                user1: teams[tables.table1[i][j] - 1].user1,
                user2: teams[tables.table1[i][j] - 1].user2,
                id: teams[tables.table1[i][j] - 1].id,
              };

              const team2 = {
                user1: teams[tables.table2[i][j] - 1].user1,
                user2: teams[tables.table2[i][j] - 1].user2,
                id: teams[tables.table2[i][j] - 1].id,
              };
              const match = {
                id: randomUUID(),
                nextMatchId: null,
                title: `Match ${j + 1}`,
                date: null,
                duration: dto.maxDuration,
                status: MatchStatus.scheduled,
                teams: { team1, team2 },
              };
              matches.push(match);
            }
            const round = {
              title: `Round ${i + 1}`,
              matches: matches,
              id: randomUUID(),
            };
            rounds.push(round);
          }
          const group = {
            id: randomUUID(),
            title: 'Round Robin Group',
            isFinal: true,
            rounds: rounds,
          };
          return {
            id: randomUUID(),
            roundRobinGroups: [group],
            status: 'new',
            participantType: teams[0].tournaments.participantType,
            format: 'round_robin',
          };
        } else if (dto.format === TournamentFormat.knockout) {
          const tables = this.formatTournamentService.generateTables(
            dto.format,
            1,
            teams.length,
          );

  //         for (let i = 0; i < tables.table1.length; i++) {
  //           const rawMatches = [];
  //           let status = MatchStatus.scheduled.toString();
  //           for (let j = 0; j < tables.table1[i].length; j++) {
  //             let id = randomUUID();
  //             let nextMatchId = randomUUID();
  //             if (i === 0) {
  //               if (j % 2 !== 0) {
  //                 nextMatchId = rawMatches[j - 1].nextMatchId;
  //               }
  //             } else if (i === tables.table1.length - 1) {
  //               id = rounds[i - 1].matches[j * 2].nextMatchId;
  //               nextMatchId = null;
  //             } else {
  //               if (j % 2 !== 0) {
  //                 nextMatchId = rawMatches[j - 1].nextMatchId;
  //               }
  //               id = rounds[i - 1].matches[j * 2].nextMatchId;
  //             }

              let team1 = null,
                team2 = null;
              if (tables.table1[i][j] !== 0 && tables.table1[i][j] !== -1) {
                team1 = {
                  user1: teams[tables.table1[i][j] - 1].user1,
                  user2: teams[tables.table1[i][j] - 1].user2,
                  id: teams[tables.table1[i][j] - 1].id,
                };
              } else {
                status = MatchStatus.skipped.toString();
              }

              if (tables.table2[i][j] !== 0 && tables.table2[i][j] !== -1) {
                team2 = {
                  user1: teams[tables.table2[i][j] - 1].user1,
                  user2: teams[tables.table2[i][j] - 1].user2,
                  id: teams[tables.table2[i][j] - 1].id,
                };
                status = MatchStatus.scheduled.toString();
              } else {
                status = MatchStatus.skipped.toString();
              }

              if (tables.table1[i][j] === -1 || tables.table2[i][j] === -1) {
                status = MatchStatus.no_show.toString();
              }
              const match = {
                id: id,
                nextMatchId: nextMatchId,
                title: `Match ${j + 1}`,
                date: null,
                duration: dto.maxDuration,
                status: status,
                teams: { team1, team2 },
              };
              rawMatches.push(match);
            }
            const round = {
              title: `Round ${i + 1}`,
              id: randomUUID(),
              matches: rawMatches,
            };
            rounds.push(round);
          }
          const group = {
            id: randomUUID(),
            title: 'Knockout Group',
            isFinal: true,
            rounds: rounds,
          };
          return {
            id: randomUUID(),
            knockoutGroup: group,
            status: 'new',
            participantType: teams[0].tournaments.participantType,
            format: 'knockout',
          };
        }
      }
      //get list of team order by rank

      const rounds = [];
      const tournament = await this.prismaService.tournaments.findFirst({
        where: {
          id: id,
        },
      });
      //generate matches
      if (dto.format === TournamentFormat.group_playoff) {
        const groups = [];
        for (let i = 0; i < dto.groups.length; i++) {
          const teams = await Promise.all(
            dto.groups[i].groupMembers.map((memberId) => {
              return this.prismaService.teams.findFirst({
                where: {
                  tournamentId: id,
                  id: memberId,
                },
                include: {
                  user1: {
                    select: {
                      id: true,
                      image: true,
                      name: true,
                    },
                  },
                  user2: {
                    select: {
                      id: true,
                      image: true,
                      name: true,
                    },
                  },
                  tournaments: true,
                },
              });
            }),
          );
          const groupRounds = [];
          const tables = this.formatTournamentService.generateTables(
            'round_robin',
            1,
            teams.length,
          );
          for (let i = 0; i < tables.table1.length; i++) {
            const matches = [];
            for (let j = 0; j < tables.table1[i].length; j++) {
              const team1 = {
                user1: teams[tables.table1[i][j] - 1].user1,
                user2: teams[tables.table1[i][j] - 1].user2,
                id: teams[tables.table1[i][j] - 1].id,
              };

              const team2 = {
                user1: teams[tables.table2[i][j] - 1].user1,
                user2: teams[tables.table2[i][j] - 1].user2,
                id: teams[tables.table2[i][j] - 1].id,
              };
              const match = {
                id: randomUUID(),
                nextMatchId: null,
                title: `Match ${j + 1}`,
                date: null,
                duration: dto.maxDuration,
                status: MatchStatus.scheduled,
                teams: { team1, team2 },
              };
              matches.push(match);
            }
            const round = {
              title: `Round ${i + 1}`,
              matches: matches,
              id: randomUUID(),
            };
            groupRounds.push(round);
          }
          const group = {
            title: `Group ${String.fromCharCode(65 + i)}`,
            rounds: groupRounds,
            id: randomUUID(),
            numberOfProceeders: dto.groups[i].numberOfProceeders,
            isFinal: false,
          };
          groups.push(group);
        }

        const winnersByGroup = [];
        for (const group of groups) {
          const { title, numberOfProceeders, id } = group;
          // Generate winner labels with correct numbering
          const winners = [];
          for (let i = 1; i <= numberOfProceeders; i++) {
            winners.push({ title: `Winner ${i} Of ${title}`, id: id, rank: i });
          }
          winnersByGroup.push(winners);
        }
        const winners = mergeArrays(winnersByGroup);
        const tables = this.formatTournamentService.generateTables(
          'knockout',
          1,
          winners.length,
        );

  //       for (let i = 0; i < tables.table1.length; i++) {
  //         const rawMatches = [];
  //         let status = MatchStatus.scheduled.toString();
  //         for (let j = 0; j < tables.table1[i].length; j++) {
  //           let id = randomUUID();
  //           let nextMatchId = randomUUID();
  //           if (i === 0) {
  //             if (j % 2 !== 0) {
  //               nextMatchId = rawMatches[j - 1].nextMatchId;
  //             }
  //           } else if (i === tables.table1.length - 1) {
  //             id = rounds[i - 1].matches[j * 2].nextMatchId;
  //             nextMatchId = null;
  //           } else {
  //             if (j % 2 !== 0) {
  //               nextMatchId = rawMatches[j - 1].nextMatchId;
  //             }
  //             id = rounds[i - 1].matches[j * 2].nextMatchId;
  //           }
  //           let team1 = null,
  //             team2 = null,
  //             groupFixtureTeamId1 = null,
  //             groupFixtureTeamId2 = null,
  //             rankGroupTeam1 = null,
  //             rankGroupTeam2 = null;
  //           if (tables.table1[i][j] !== 0 && tables.table1[i][j] !== -1) {
  //             groupFixtureTeamId1 = winners[tables.table1[i][j] - 1].id;
  //             rankGroupTeam1 = winners[tables.table1[i][j] - 1].rank;
  //             const user2 =
  //               tournament.participantType === 'singles'
  //                 ? null
  //                 : { name: winners[tables.table1[i][j] - 1].title };
  //             team1 = {
  //               user1: { name: winners[tables.table1[i][j] - 1].title },
  //               user2,
  //             };
  //           } else {
  //             status = MatchStatus.skipped.toString();
  //           }

  //           if (tables.table2[i][j] !== 0 && tables.table2[i][j] !== -1) {
  //             groupFixtureTeamId2 = winners[tables.table2[i][j] - 1].id;
  //             rankGroupTeam2 = winners[tables.table2[i][j] - 1].rank;
  //             const user2 =
  //               tournament.participantType === 'singles'
  //                 ? null
  //                 : { name: winners[tables.table2[i][j] - 1].title };
  //             team2 = {
  //               user1: { name: winners[tables.table2[i][j] - 1].title },
  //               user2,
  //             };
  //             status = MatchStatus.scheduled.toString();
  //           } else {
  //             status = MatchStatus.skipped.toString();
  //           }

            if (tables.table1[i][j] === -1 || tables.table2[i][j] === -1) {
              status = MatchStatus.no_show.toString();
            }
            const match = {
              id: id,
              nextMatchId: nextMatchId,
              title: `Match ${j + 1}`,
              date: null,
              duration: dto.maxDuration,
              status: status,
              teams: { team1, team2 },
              groupFixtureTeamId1,
              groupFixtureTeamId2,
              rankGroupTeam1,
              rankGroupTeam2,
            };
            rawMatches.push(match);
          }
          const round = {
            title: `Round ${i + 1}`,
            id: randomUUID(),
            matches: rawMatches,
          };
          rounds.push(round);
        }

        const knockoutGroup = {
          id: randomUUID(),
          title: 'Knockout Group',
          isFinal: true,
          rounds: rounds,
        };
        return {
          id: randomUUID(),
          roundRobinGroups: groups,
          knockoutGroup,
          status: 'new',
          participantType: tournament.participantType,
          format: 'group_playoff',
        };
      }
    } catch (error) {}
  }

  async createFixture(id: number, dto: CreateFixtureDto) {
    const numberOfParticipants = await this.prismaService.teams.count({
      where: {
        tournamentId: id,
      },
    });
    await this.prismaService.$transaction(async (tx) => {
      const fixture = await tx.fixtures.upsert({
        where: {
          id: dto.id,
        },
        update: {
          numberOfParticipants: numberOfParticipants,
          numberOfGroups: dto.roundRobinGroups?.length ?? 1,
          fixtureStartDate: dto.fixtureStartDate,
          fixtureEndDate: dto.fixtureEndDate,
          matchesStartTime: dto.matchesStartTime,
          matchesEndTime: dto.matchesEndTime,
          matchDuration: dto.maxDuration,
          breakDuration: dto.breakDuration,
          status: dto.status,
        },
        create: {
          id: dto.id,
          tournamentId: id,
          numberOfParticipants: numberOfParticipants,
          numberOfGroups: dto.roundRobinGroups.length,
          fixtureStartDate: dto.fixtureStartDate,
          fixtureEndDate: dto.fixtureEndDate,
          matchesStartTime: dto.matchesStartTime,
          matchesEndTime: dto.matchesEndTime,
          matchDuration: dto.maxDuration,
          breakDuration: dto.breakDuration,
          status: dto.status,
        },
      });

      if (dto.format === TournamentFormat.round_robin) {
        await Promise.all(
          dto.roundRobinGroups.map(async (group) => {
            await tx.group_fixtures.upsert({
              where: {
                id: group.id,
              },
              update: {
                fixtureId: fixture.id,
                title: group.title,
                isFinal: true,
              },
              create: {
                id: group.id,
                fixtureId: fixture.id,
                title: group.title,
                isFinal: true,
              },
            });
            await Promise.all(
              group.rounds.map(async (round) => {
                await tx.rounds.upsert({
                  where: {
                    id: round.id,
                  },
                  update: {
                    groupFixtureId: group.id,
                    title: round.title,
                    elo: 100,
                  },
                  create: {
                    id: round.id,
                    groupFixtureId: group.id,
                    title: round.title,
                    elo: 100,
                  },
                });
                //apply elo
                await Promise.all(
                  round.matches.map(async (match) => {
                    await tx.matches.upsert({
                      where: {
                        id: match.id,
                      },
                      update: {
                        roundId: round.id,
                        title: match.title,
                        status: match.status,
                        rankGroupTeam1: match.rankGroupTeam1,
                        rankGroupTeam2: match.rankGroupTeam2,
                        nextMatchId: match.nextMatchId,
                        matchStartDate: match.date,
                        teamId1: match.teams.team1?.id,
                        teamId2: match.teams.team2?.id,
                        venue: match?.venue,
                        matchDuration: dto.maxDuration,
                        breakDuration: dto.breakDuration,
                      },

                      create: {
                        id: match.id,
                        roundId: round.id,
                        title: match.title,
                        status: match.status,
                        rankGroupTeam1: match.rankGroupTeam1,
                        rankGroupTeam2: match.rankGroupTeam2,
                        nextMatchId: match.nextMatchId,
                        matchStartDate: match.date,
                        teamId1: match.teams.team1?.id,
                        teamId2: match.teams.team2?.id,
                        venue: match.venue,
                        matchDuration: dto.maxDuration,
                        breakDuration: dto.breakDuration,
                      },
                    });
                  }),
                );
              }),
            );
          }),
        );
      } else if (dto.format === TournamentFormat.knockout) {
        await tx.group_fixtures.upsert({
          where: {
            id: dto.knockoutGroup.id,
          },
          update: {
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
          },
          create: {
            id: dto.knockoutGroup.id,
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
          },
        });
        await Promise.all(
          dto.knockoutGroup.rounds.map(async (round) => {
            await tx.rounds.upsert({
              where: {
                id: round.id,
              },
              update: {
                groupFixtureId: dto.knockoutGroup.id,
                title: round.title,
                elo: 100,
              },
              create: {
                id: round.id,
                groupFixtureId: dto.knockoutGroup.id,
                title: round.title,
                elo: 100,
              },
            });
            //apply elo
            await Promise.all(
              round.matches.map(async (match) => {
                await tx.matches.upsert({
                  where: {
                    id: match.id,
                  },
                  update: {
                    roundId: round.id,
                    title: match.title,
                    status: match.status,
                    rankGroupTeam1: match.rankGroupTeam1,
                    rankGroupTeam2: match.rankGroupTeam2,
                    nextMatchId: match.nextMatchId,
                    matchStartDate: match.date,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.maxDuration,
                    breakDuration: dto.breakDuration,
                  },

                  create: {
                    id: match.id,
                    roundId: round.id,
                    title: match.title,
                    status: match.status,
                    rankGroupTeam1: match.rankGroupTeam1,
                    rankGroupTeam2: match.rankGroupTeam2,
                    nextMatchId: match.nextMatchId,
                    matchStartDate: match.date,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.maxDuration,
                    breakDuration: dto.breakDuration,
                  },
                });
              }),
            );
          }),
        );
      } else if (dto.format === TournamentFormat.group_playoff) {
        await Promise.all(
          dto.roundRobinGroups.map(async (group) => {
            await tx.group_fixtures.upsert({
              where: {
                id: group.id,
              },
              update: {
                fixtureId: fixture.id,
                title: group.title,
                isFinal: false,
              },
              create: {
                id: group.id,
                fixtureId: fixture.id,
                title: group.title,
                isFinal: false,
              },
            });
            await Promise.all(
              group.rounds.map(async (round) => {
                await tx.rounds.upsert({
                  where: {
                    id: round.id,
                  },
                  update: {
                    groupFixtureId: group.id,
                    title: round.title,
                    elo: 100,
                  },
                  create: {
                    id: round.id,
                    groupFixtureId: group.id,
                    title: round.title,
                    elo: 100,
                  },
                });
                //apply elo
                await Promise.all(
                  round.matches.map(async (match) => {
                    await tx.matches.upsert({
                      where: {
                        id: match.id,
                      },
                      update: {
                        roundId: round.id,
                        title: match.title,
                        status: match.status,
                        rankGroupTeam1: match.rankGroupTeam1,
                        rankGroupTeam2: match.rankGroupTeam2,
                        nextMatchId: match.nextMatchId,
                        matchStartDate: match.date,
                        teamId1: match.teams.team1.id,
                        teamId2: match.teams.team2.id,
                        venue: match.venue,
                        matchDuration: dto.maxDuration,
                        breakDuration: dto.breakDuration,
                      },

                      create: {
                        id: match.id,
                        roundId: round.id,
                        title: match.title,
                        status: match.status,
                        rankGroupTeam1: match.rankGroupTeam1,
                        rankGroupTeam2: match.rankGroupTeam2,
                        nextMatchId: match.nextMatchId,
                        matchStartDate: match.date,
                        teamId1: match.teams.team1.id,
                        teamId2: match.teams.team2.id,
                        venue: match.venue,
                        matchDuration: dto.maxDuration,
                        breakDuration: dto.breakDuration,
                      },
                    });
                  }),
                );
              }),
            );
          }),
        );

        //knockout
        await tx.group_fixtures.upsert({
          where: {
            id: dto.knockoutGroup.id,
          },
          update: {
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
          },
          create: {
            id: dto.knockoutGroup.id,
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
          },
        });
        await Promise.all(
          dto.knockoutGroup.rounds.map(async (round) => {
            await tx.rounds.upsert({
              where: {
                id: round.id,
              },
              update: {
                groupFixtureId: dto.knockoutGroup.id,
                title: round.title,
                elo: 100,
              },
              create: {
                id: round.id,
                groupFixtureId: dto.knockoutGroup.id,
                title: round.title,
                elo: 100,
              },
            });
            //apply elo
            await Promise.all(
              round.matches.map(async (match) => {
                await tx.matches.upsert({
                  where: {
                    id: match.id,
                  },
                  update: {
                    roundId: round.id,
                    title: match.title,
                    status: match.status,
                    rankGroupTeam1: match.rankGroupTeam1,
                    rankGroupTeam2: match.rankGroupTeam2,
                    nextMatchId: match.nextMatchId,
                    matchStartDate: match.date,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.maxDuration,
                    breakDuration: dto.breakDuration,
                  },

                  create: {
                    id: match.id,
                    roundId: round.id,
                    title: match.title,
                    status: match.status,
                    rankGroupTeam1: match.rankGroupTeam1,
                    rankGroupTeam2: match.rankGroupTeam2,
                    nextMatchId: match.nextMatchId,
                    matchStartDate: match.date,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.maxDuration,
                    breakDuration: dto.breakDuration,
                  },
                });
              }),
            );
          }),
        );
      }
    });

    //return response
    const { groupFixtures, ...others } =
      await this.prismaService.fixtures.findFirst({
        where: {
          id: dto.id,
        },
        include: {
          groupFixtures: {
            where: {
              isFinal: true,
            },
            include: {
              rounds: {
                include: {
                  matches: {
                    include: {
                      team1: {
                        include: {
                          user1: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                            },
                          },
                          user2: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                            },
                          },
                        },
                      },
                      team2: {
                        include: {
                          user1: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                            },
                          },
                          user2: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    if (dto.format === TournamentFormat.round_robin) {
      return { ...others, roundRobinGroups: groupFixtures };
    } else if (dto.format === TournamentFormat.knockout) {
      return { ...others, knockoutGroup: groupFixtures[0] };
    } else if (dto.format === TournamentFormat.group_playoff) {
      const knockoutGroup = groupFixtures[0];
      const roundRobinGroups = await this.prismaService.group_fixtures.findMany(
        {
          where: {
            isFinal: false,
            fixtureId: dto.id,
          },
          include: {
            rounds: {
              include: {
                matches: {
                  include: {
                    team1: {
                      include: {
                        user1: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                        user2: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                      },
                    },
                    team2: {
                      include: {
                        user1: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                        user2: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      );
      return {
        ...others,
        knockoutGroup,
        roundRobinGroups,
      };
    }
  }
}

function mergeArrays(arrays) {
  const mergedArray = [];
  for (let i = 0; i < Math.max(...arrays.map((arr) => arr.length)); i++) {
    for (const arr of arrays) {
      if (arr[i] !== undefined) {
        mergedArray.push(arr[i]);
      }
    }
  }
  return mergedArray;
}
