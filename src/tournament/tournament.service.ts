import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import {
  CreateApplyApplicantDto,
  CreateTournamentDto,
  PageOptionsTournamentDto,
  PageOptionsTournamentRegistrationDto,
} from './dto';
import {
  FixtureStatus,
  MatchStatus,
  ParticipantType,
  Prisma,
  RegistrationStatus,
  TournamentFormat,
  TournamentPhase,
  TournamentStatus,
  tournaments,
} from '@prisma/client';
import { FormatTournamentService } from 'src/services/format_tournament/format_tournament.service';
import {
  CreateFixtureDto,
  GenerateFixtureDto,
} from 'src/fixture/dto/create-fixture.dto';
import { randomUUID } from 'crypto';
import { CreateFixtureGroupPlayoffDto } from 'src/fixture/dto/create-fixture-groupplayoff.dto';
import { CustomResponseStatusCodes } from 'src/helper/custom-response-status-code';
import { CustomResponseMessages } from 'src/helper/custom-response-message';

@Injectable()
export class TournamentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
    private readonly formatTournamentService: FormatTournamentService,
  ) {}

  async getTournamentsList(pageOptions: PageOptionsTournamentDto) {
    // Build page options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {},
    };

    if (pageOptions.gender) {
      conditions.where['gender'] = pageOptions.gender;
    }

    if (pageOptions.format) {
      conditions.where['format'] = pageOptions.format;
    }

    if (pageOptions.participantType) {
      conditions.where['participantType'] = pageOptions.participantType;
      if (pageOptions.participantType === ParticipantType.mixed_doubles) {
        conditions.where['gender'] = null;
      }
    }

    if (pageOptions.status) {
      conditions.where['status'] = pageOptions.status;
    }

    if (pageOptions.phase) {
      if (pageOptions.phase !== TournamentPhase.new) {
        conditions.where['phase'] = pageOptions.phase;
      } else {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          ),
          data: null,
        });
      }
    } else {
      conditions.where['NOT'] = {
        phase: TournamentPhase.new,
      };
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get all tournaments
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournaments.findMany({
        ...conditions,
        ...pageOption,
        include: {
          _count: {
            select: {
              tournament_registrations: true,
            }, // Count registrations for each tournament
          },
        },
      }),
      this.prismaService.tournaments.count(conditions),
    ]);

    // Modify the structure of the returned data
    const modified_result = result.map((tournament) => {
      const participantCount = tournament._count.tournament_registrations;
      delete tournament._count;

      return {
        ...tournament,
        participants: participantCount,
      };
    });

    return {
      data: modified_result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  // For normal usage
  async getTournamentDetails(userId: string | undefined, tournamentId: number) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
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
    userId: string,
    pageOptions: PageOptionsTournamentDto,
  ) {
    // Get user's purchased packages
    const purchasedPackages =
      await this.mongodbPrismaService.purchasedPackage.findMany({
        where: {
          userId: userId,
          endDate: {
            gt: new Date(), // Not expired purchased packages
          },
        },
      });

    // Get purchased packages that have the "Tournament" service
    const filteredPurchasedPackages = purchasedPackages.filter(
      (purchasedPackage) =>
        purchasedPackage.package.services.some(
          (service) =>
            service.name.toLowerCase().includes('tournament') === true,
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
          createdAt: pageOptions.order,
        },
      ],
      where: {
        purchasedPackageId: {
          in: purchasedPackageIds,
        },
      },
    };

    if (pageOptions.gender) {
      conditions.where['gender'] = pageOptions.gender;
    }

    if (pageOptions.format) {
      conditions.where['format'] = pageOptions.format;
    }

    if (pageOptions.participantType) {
      conditions.where['participantType'] = pageOptions.participantType;
      if (pageOptions.participantType === ParticipantType.mixed_doubles) {
        conditions.where['gender'] = null;
      }
    }

    if (pageOptions.status) {
      conditions.where['status'] = pageOptions.status;
    }

    if (pageOptions.phase) {
      conditions.where['phase'] = pageOptions.phase;
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get tournaments that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournaments.findMany({
        ...conditions,
        ...pageOption,
        include: {
          _count: {
            select: {
              tournament_registrations: true,
            },
          },
        },
      }),
      this.prismaService.tournaments.count(conditions),
    ]);

    // Modify the structure of the returned data
    const modified_result = result.map((tournament) => {
      const participantCount = tournament._count.tournament_registrations;
      delete tournament._count;

      return {
        ...tournament,
        participants: participantCount,
      };
    });

    return {
      data: modified_result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async getUnregisteredTournaments(
    userId: string,
    pageOptions: PageOptionsTournamentDto,
  ) {
    // Get tournament registrations that the user has registered
    const userTournamentRegistrations =
      await this.prismaService.tournament_registrations.findMany({
        where: {
          OR: [
            {
              userId1: userId,
            },
            {
              userId2: userId,
            },
          ],
          NOT: {
            OR: [
              {
                status: RegistrationStatus.canceled,
              },
              {
                status: RegistrationStatus.rejected,
              },
            ],
          },
        },
        select: {
          tournamentId: true,
        },
      });

    // Map to get only tournamentId as an array
    const userRegisteredTournamentIds = userTournamentRegistrations.map(
      (registration) => registration.tournamentId,
    );

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        NOT: {
          id: {
            in: userRegisteredTournamentIds,
          },
        },
        status: TournamentStatus.upcoming,
        registrationDueDate: {
          gt: new Date(),
        },
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get user's tournament registrations (participated)
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournaments.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournaments.count(conditions),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async createTournament(userId: string, dto: CreateTournamentDto) {
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the Purchased package have the service == "Tournament"
    const tournamentService = purchasedPackage.package.services.find(
      (service) => service.name.toLowerCase().includes('tournament') === true,
    );

    if (!tournamentService) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PACKAGE_DOES_NOT_HAVE_CREATE_TOURNAMENT_SERVICE,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PACKAGE_DOES_NOT_HAVE_CREATE_TOURNAMENT_SERVICE,
        ),
        data: null,
      });
    }

    // Check if the user has exceeded the allowed number of tournaments
    const count = await this.prismaService.tournaments.count({
      where: {
        purchasedPackageId: dto.purchasedPackageId,
      },
    });
    if (count >= JSON.parse(tournamentService.config).maxTournaments) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PACKAGE_EXCEEDED_CREATE_TOURNAMENT_LIMIT,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PACKAGE_EXCEEDED_CREATE_TOURNAMENT_LIMIT,
        ),
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
        code: CustomResponseStatusCodes.PACKAGE_EXCEEDED_MAX_PARTICIPANTS_LIMIT,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PACKAGE_EXCEEDED_MAX_PARTICIPANTS_LIMIT,
        ),
        data: null,
      });
    }

    // Check tournament format
    if (dto.participantType === ParticipantType.mixed_doubles) {
      dto.gender = null;
    } else {
      if (!dto.gender) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_CREATED_FAILED,
          message: "Missing 'gender' field",
          data: null,
        });
      }
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
        if (service.name.toLowerCase().includes('tournament') === true) {
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
        code: CustomResponseStatusCodes.TOURNAMENT_CREATED_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_CREATED_FAILED,
        ),
        data: null,
      });
    }
  }

  async publishTournament(userId: string, tournamentId: number) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (purchasedPackage.userId !== userId) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_UNAUTHORIZED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_UNAUTHORIZED,
        ),
        data: null,
      });
    }

    if (tournament.phase === TournamentPhase.published) {
      return {
        message: 'Tournament already published',
        data: null,
      };
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
        code: CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_FAILED,
        ),
        data: null,
      });
    }
  }

  // Participants
  // Creator
  async getApplicantsList(
    userId: string,
    tournamentId: number,
    pageOptions: PageOptionsTournamentRegistrationDto,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
        data: null,
      });
    }

    let projection = {};
    if (tournament.participantType === ParticipantType.single) {
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
          createdAt: pageOptions.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
      },
      select: {
        ...projection,
      },
    };

    if (pageOptions.status) {
      conditions.where['status'] = pageOptions.status;
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
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
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async approveApplicant(
    tournamentId: number,
    userId: string,
    applicantId: string,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
        data: null,
      });
    }

    // Check if applicantId is provided
    if (!applicantId) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_SUBMITTED_REGISTRATION_INVALID,
        message:
          CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_SUBMITTED_REGISTRATION_INVALID,
          ) + ": 'applicantId - userId' is required",
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
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        ),
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
      throw new InternalServerErrorException({
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_APPROVE_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_APPROVE_FAILED,
        ),
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
    userId: string,
    applicantId: string,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
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
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_REJECT_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_REJECT_FAILED,
        ),
        data: null,
      });
    }

    return {
      message: 'Applicant rejected successfully',
      data: null,
    };
  }

  async finalizeApplicantList(tournamentId: number, userId: string) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
        data: null,
      });
    }

    // Check if the tournament status is already finalized_applicants
    if (tournament.phase === TournamentPhase.finalized_applicants) {
      return {
        code: CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_ALREADY_FINALIZED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_ALREADY_FINALIZED,
        ),
        data: null,
      };
    }

    // Update tournament
    // phase -> finalized_applicants
    // status -> on_going
    try {
      return await this.prismaService.$transaction(async (tx) => {
        await tx.tournaments.update({
          where: {
            id: tournamentId,
          },
          data: {
            phase: TournamentPhase.finalized_applicants,
            status: TournamentStatus.on_going,
          },
        });
        const applicants = await tx.tournament_registrations.findMany({
          where: {
            tournamentId: tournamentId,
          },
        });
        const teams = await Promise.all(
          applicants.map(async (applicant) => {
            const { tournamentId, userId1, userId2, name } = applicant;

            const user1 = await tx.users.findFirst({
              where: {
                id: userId1,
              },
            });

            let user2 = null;
            if (userId2) {
              user2 = await tx.users.findFirst({
                where: {
                  id: userId2,
                },
              });
            }

            const totalElo = (user1?.elo ?? 0) + (user2?.elo ?? 0);
            return {
              name,
              userId1,
              userId2,
              totalElo,
              tournamentId,
            };
          }),
        );
        return await tx.teams.createMany({
          data: teams,
        });
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        code: CustomResponseStatusCodes.TOURNAMENT_FINALIZED_APPLICANT_LIST_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_FINALIZED_APPLICANT_LIST_FAILED,
        ),
        data: null,
      });
    }
  }

  async getTournamentParticipants(
    tournamentId: number,
    pageOptions: PageOptionsTournamentRegistrationDto,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the tournament status is finalized_applicants
    if (tournament.phase !== TournamentPhase.finalized_applicants) {
      return {
        code: CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_NOT_FINALIZED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_NOT_FINALIZED,
        ),
        data: null,
      };
    }

    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
        status: RegistrationStatus.approved, // Only approved participants
      },
    };

    if (tournament.participantType === ParticipantType.single) {
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
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
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
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  // Applicant
  async getSubmittedApplications(userId: string, tournamentId: number) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
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
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        ),
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
    if (tournament.participantType === ParticipantType.single) {
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
          code: CustomResponseStatusCodes.TOURNAMENT_SUBMITTED_REGISTRATION_INVALID,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_SUBMITTED_REGISTRATION_INVALID,
          ),
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
    userId: string,
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
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check if tournament's status and phase is valid
    if (
      tournament.phase !== TournamentPhase.published ||
      tournament.status !== TournamentStatus.upcoming
    ) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check max participants
    const participantsCount =
      await this.getTournamentParticipantsCount(tournamentId);
    if (participantsCount >= tournament.maxParticipants) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PACKAGE_EXCEEDED_MAX_PARTICIPANTS_LIMIT,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PACKAGE_EXCEEDED_MAX_PARTICIPANTS_LIMIT,
        ),
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
    if (tournament.participantType === ParticipantType.single) {
      // Check if user has already applied
      const existingRegistration =
        await this.prismaService.tournament_registrations.findFirst({
          where: {
            tournamentId: tournamentId,
            userId1: userId,
            NOT: {
              status: RegistrationStatus.canceled,
            },
          },
        });

      if (existingRegistration) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_APPLIED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_APPLIED,
          ),
          data: null,
        });
      }

      // Check tournament participant type gender
      if (user1.gender !== tournament.gender) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION0_INVALID_GENDER,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION0_INVALID_GENDER,
          ),
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
            NOT: {
              status: RegistrationStatus.canceled,
            },
          },
        });

      if (existingRegistration) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_APPLIED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_APPLIED,
          ),
          data: null,
        });
      }

      if (tournament.participantType === ParticipantType.mixed_doubles) {
        if (user1.gender === user2Res.gender) {
          throw new BadRequestException({
            code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION0_INVALID_GENDER,
            message: CustomResponseMessages.getMessage(
              CustomResponseStatusCodes.TOURNAMENT_REGISTRATION0_INVALID_GENDER,
            ),
            data: null,
          });
        }
      } else {
        if (
          user1.gender !== tournament.gender ||
          user2Res.gender !== tournament.gender
        ) {
          throw new BadRequestException({
            code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION0_INVALID_GENDER,
            message: CustomResponseMessages.getMessage(
              CustomResponseStatusCodes.TOURNAMENT_REGISTRATION0_INVALID_GENDER,
            ),
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
    if (tournament.participantType === ParticipantType.single) {
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
      message: 'Application submitted successfully',
      data: response_data,
    };
  }

  async cancelApplication(userId: string, tournamentId: number) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_NOT_FOUND,
        ),
        data: null,
      };
    }

    // Check application status
    if (
      !['inviting', 'pending'].includes(
        tournament_registration.status.toString(),
      )
    ) {
      if (
        tournament_registration.status.toString() ===
        RegistrationStatus.canceled
      ) {
        return {
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_CANCEL,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_CANCEL,
          ),
          data: null,
        };
      } else {
        return {
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANNOT_CANCEL,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANNOT_CANCEL,
          ),
          data: null,
        };
      }
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
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANCEL_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANCEL_FAILED,
        ),
        data: null,
      });
    }

    return {
      message: 'Application canceled successfully',
      data: null,
    };
  }

  async getTournamentInvitations(
    userId: string,
    tournamentId: number,
    pageOptions: PageOptionsTournamentRegistrationDto,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check expiration date of the purchased package
    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Get list of tournament invitations
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
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
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
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
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async acceptInvitation(
    userId: string,
    tournamentId: number,
    inviterId: string,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          tournamentId: tournamentId,
          userId1: inviterId,
          userId2: userId,
        },
      });

    if (!tournament_registration) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVITATION_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVITATION_NOT_FOUND,
        ),
        data: null,
      });
    }

    if (tournament_registration.status === RegistrationStatus.pending) {
      return {
        code: CustomResponseStatusCodes.TOURNAMENT_INVITATION_ALREADY_ACCEPTED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVITATION_ALREADY_ACCEPTED,
        ),
        data: null,
      };
    }

    // Update tournament registration status -> pending
    try {
      await this.prismaService.tournament_registrations.update({
        where: {
          id: tournament_registration.id,
        },
        data: {
          status: RegistrationStatus.pending,
        },
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVITATION_ACCEPT_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVITATION_ACCEPT_FAILED,
        ),
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
    userId: string,
    tournamentId: number,
    inviterId: string,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
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
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Get tournament registration info
    const tournament_registration =
      await this.prismaService.tournament_registrations.findFirst({
        where: {
          tournamentId: tournamentId,
          userId1: inviterId,
          userId2: userId,
        },
      });

    if (!tournament_registration) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVITATION_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVITATION_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Check if the application status is inviting or not
    if (
      !['inviting', 'pending'].includes(
        tournament_registration.status.toString(),
      )
    ) {
      if (tournament_registration.status === RegistrationStatus.canceled) {
        return {
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_CANCEL,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_ALREADY_CANCEL,
          ),
          data: null,
        };
      } else {
        // Status is approved or rejected by admin
        return {
          code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANNOT_CANCEL,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANNOT_CANCEL,
          ),
          data: null,
        };
      }
    }

    // Update tournament registration status -> canceled
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
      throw new InternalServerErrorException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVITATION_REJECT_FAILED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVITATION_REJECT_FAILED,
        ),
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

  async cancelAllTournamentInvitations(userId: string, tournamentId: number) {
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

    const groups = this.formatTournamentService
      .generateGroupPlayOffPhase1(teams.length, dto.numberOfGroups)
      .map((group) => {
        return group.map((member) => {
          return teams[member - 1];
        });
      });
    return groups;
  }

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
                duration: dto.matchDuration,
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

          for (let i = 0; i < tables.table1.length; i++) {
            const rawMatches = [];
            let status = MatchStatus.scheduled.toString();
            for (let j = 0; j < tables.table1[i].length; j++) {
              let id = randomUUID();
              let nextMatchId = randomUUID();
              if (i === 0) {
                if (j % 2 !== 0) {
                  nextMatchId = rawMatches[j - 1].nextMatchId;
                }
              } else if (i === tables.table1.length - 1) {
                id = rounds[i - 1].matches[j * 2].nextMatchId;
                nextMatchId = null;
              } else {
                if (j % 2 !== 0) {
                  nextMatchId = rawMatches[j - 1].nextMatchId;
                }
                id = rounds[i - 1].matches[j * 2].nextMatchId;
              }

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
                duration: dto.matchDuration,
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
                duration: dto.matchDuration,
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

        for (let i = 0; i < tables.table1.length; i++) {
          const rawMatches = [];
          let status = MatchStatus.scheduled.toString();
          for (let j = 0; j < tables.table1[i].length; j++) {
            let id = randomUUID();
            let nextMatchId = randomUUID();
            if (i === 0) {
              if (j % 2 !== 0) {
                nextMatchId = rawMatches[j - 1].nextMatchId;
              }
            } else if (i === tables.table1.length - 1) {
              id = rounds[i - 1].matches[j * 2].nextMatchId;
              nextMatchId = null;
            } else {
              if (j % 2 !== 0) {
                nextMatchId = rawMatches[j - 1].nextMatchId;
              }
              id = rounds[i - 1].matches[j * 2].nextMatchId;
            }
            let team1 = null,
              team2 = null,
              groupFixtureTeamId1 = null,
              groupFixtureTeamId2 = null,
              rankGroupTeam1 = null,
              rankGroupTeam2 = null;
            if (tables.table1[i][j] !== 0 && tables.table1[i][j] !== -1) {
              groupFixtureTeamId1 = winners[tables.table1[i][j] - 1].id;
              rankGroupTeam1 = winners[tables.table1[i][j] - 1].rank;
              const user2 =
                tournament.participantType === ParticipantType.single
                  ? null
                  : { name: winners[tables.table1[i][j] - 1].title };
              team1 = {
                user1: { name: winners[tables.table1[i][j] - 1].title },
                user2,
              };
            } else {
              status = MatchStatus.skipped.toString();
            }

            if (tables.table2[i][j] !== 0 && tables.table2[i][j] !== -1) {
              groupFixtureTeamId2 = winners[tables.table2[i][j] - 1].id;
              rankGroupTeam2 = winners[tables.table2[i][j] - 1].rank;
              const user2 =
                tournament.participantType === ParticipantType.single
                  ? null
                  : { name: winners[tables.table2[i][j] - 1].title };
              team2 = {
                user1: { name: winners[tables.table2[i][j] - 1].title },
                user2,
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
              duration: dto.matchDuration,
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
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        id: dto.id,
      },
    });
    if (fixture?.status === FixtureStatus.published) {
      throw new BadRequestException({
        message: 'Fixture is already published',
      });
    }
    await this.prismaService.$transaction(async (tx) => {
      if (dto.status === FixtureStatus.published) {
        await tx.tournaments.update({
          where: {
            id: id,
          },
          data: {
            phase: TournamentPhase.generated_fixtures,
          },
        });
      }
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
          matchDuration: dto.matchDuration,
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
          matchDuration: dto.matchDuration,
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
                        matchDuration: dto.matchDuration,
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
                        matchDuration: dto.matchDuration,
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
                    matchDuration: dto.matchDuration,
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
                    matchDuration: dto.matchDuration,
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
                        matchDuration: dto.matchDuration,
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
                        matchDuration: dto.matchDuration,
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
                    matchDuration: dto.matchDuration,
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
                    matchDuration: dto.matchDuration,
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
    const groups = groupFixtures.map((groupFixture) => {
      const rounds = groupFixture.rounds.map((round) => {
        const matches = round.matches.map((match) => {
          const { team1, team2, ...others } = match;
          return { ...others, teams: { team1, team2 } };
        });
        return { ...round, matches: matches };
      });
      return { ...groupFixture, rounds: rounds };
    });
    if (dto.format === TournamentFormat.round_robin) {
      return { ...others, roundRobinGroups: groups };
    } else if (dto.format === TournamentFormat.knockout) {
      return { ...others, knockoutGroup: groups[0] };
    } else if (dto.format === TournamentFormat.group_playoff) {
      const knockoutGroup = groups[0];
      const roundRobinGroups = (
        await this.prismaService.group_fixtures.findMany({
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
        })
      ).map((groupFixture) => {
        const rounds = groupFixture.rounds.map((round) => {
          const matches = round.matches.map((match) => {
            const { team1, team2, ...others } = match;
            return { ...others, teams: { team1, team2 } };
          });
          return { ...round, matches: matches };
        });
        return { ...groupFixture, rounds: rounds };
      });
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
