import {
  BadRequestException,
  ForbiddenException,
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
  UpdateTournamentDto,
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
import { RefereesTournamentsService } from 'src/referees_tournaments/referees_tournaments.service';
import { CreateRefereesTournamentDto } from 'src/referees_tournaments/dto/create-referees_tournament.dto';
import { PageOptionsRefereesTournamentsDto } from 'src/referees_tournaments/dto/page-options-referees-tournaments.dto';
import { TournamentRole } from './tournament.enum';
import { FixtureService } from 'src/fixture/fixture.service';

@Injectable()
export class TournamentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
    private readonly formatTournamentService: FormatTournamentService,
    private readonly refereesTournamentsService: RefereesTournamentsService,
    private readonly fixtureService: FixtureService,
  ) {}

  async addReferee(
    userId: string,
    createRefereesTournamentDto: CreateRefereesTournamentDto,
  ) {
    const tournament = await this.prismaService.tournaments.findUnique({
      where: {
        id: createRefereesTournamentDto.tournamentId,
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

    if (tournament.phase != TournamentPhase.finalized_applicants) {
      throw new BadRequestException({
        code: 400,
        message: 'Tournament phase must be finalized_applicants',
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
    if (!isCreator) {
      throw new ForbiddenException({
        message: 'You are not a creator of this group',
        data: null,
      });
    }
    //Check if referee exist
    const referee = await this.prismaService.users.findFirst({
      where: {
        email: createRefereesTournamentDto.email,
      },
    });
    if (!referee) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.USER_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.USER_NOT_FOUND,
        ),
      });
    }
    //Check if referee is creator
    if (referee.id === userId) {
      throw new BadRequestException({
        code: 400,
        message: 'Referee must not be creator of tournament',
      });
    }

    //Check if referee is participant

    const participant = await this.prismaService.teams.findFirst({
      where: {
        OR: [
          {
            userId1: referee.id,
          },
          {
            userId2: referee.id,
          },
        ],
      },
    });

    if (participant) {
      throw new BadRequestException({
        code: 400,
        message: 'Referee must not be participant of tournament',
      });
    }
    const refereeTournament =
      await this.prismaService.referees_tournaments.findFirst({
        where: {
          refereeId: referee.id,
          tournamentId: createRefereesTournamentDto.tournamentId,
        },
      });
    if (refereeTournament) {
      throw new BadRequestException({
        code: 400,
        message: "Referee's already in tournament",
      });
    }
    await this.prismaService.referees_tournaments.create({
      data: {
        refereeId: referee.id,
        tournamentId: createRefereesTournamentDto.tournamentId,
      },
    });
  }

  async listReferees(
    pageOptionsRefereesTournamentsDto: PageOptionsRefereesTournamentsDto,
    tournamentId: number,
  ) {
    return this.refereesTournamentsService.findByTournament(
      pageOptionsRefereesTournamentsDto,
      tournamentId,
    );
  }
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
    const tournamentRoles = [];
    if (userId) {
      const user = await this.prismaService.users.findFirst({
        where: {
          id: userId,
        },
        include: {
          referees_tournaments: true,
        },
      });
      const participant =
        await this.prismaService.tournament_registrations.findFirst({
          where: {
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
      // Check if the user is the creator of the tournament
      if (purchasedPackage.userId === userId) {
        tournamentRoles.push(TournamentRole.CREATOR);
      } else if (user.referees_tournaments.length > 0) {
        // Check if the user is the referee of the tournament
        const referees = user.referees_tournaments.filter((r) => {
          return r.tournamentId === tournamentId;
        });
        if (referees.length > 0) {
          tournamentRoles.push(TournamentRole.REFEREE);
        }
      } else if (participant) {
        tournamentRoles.push(TournamentRole.PARTICIPANT);
      }
      if (tournamentRoles.length === 0) {
        tournamentRoles.push(TournamentRole.VIEWER);
      }
    } else {
      tournamentRoles.push(TournamentRole.VIEWER);
    }

    // Parse the config field for each service in the services array
    const parsedServices = purchasedPackage.package.services.map((service) => {
      const config = JSON.parse(service.config);
      return {
        ...service,
        config: config,
      };
    });

    //count number of participants
    const numberOfParticipants =
      await this.prismaService.tournament_registrations.count({
        where: {
          tournamentId: tournamentId,
        },
      });

    // Build response data
    delete tournament.purchasedPackageId;
    delete tournament.createdAt;
    delete tournament.updatedAt;

    const response_data = {
      ...tournament,
      purchasedPackage: {
        id: purchasedPackage.id,
        name: purchasedPackage.package.name,
        services: parsedServices,
      },
      participants: numberOfParticipants,
      tournamentRoles,
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
    //// Get tournament registrations that the user has registered
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

    //// Get this user's created tournaments
    // Get user's purchased packages
    const purchasedPackages =
      await this.mongodbPrismaService.purchasedPackage.findMany({
        where: {
          userId: userId,
          // endDate: {
          //   gt: new Date(), // Not expired purchased packages
          // },
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
        NOT: {
          OR: [
            { id: { in: userRegisteredTournamentIds } },
            { purchasedPackageId: { in: purchasedPackageIds } },
          ],
        },
        status: TournamentStatus.upcoming,
        phase: TournamentPhase.published,
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

    // Get each tournament participants count
    for (const tournament of result) {
      tournament['participants'] = await this.getTournamentParticipantsCount(
        tournament.id,
      );
    }

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
        tournamentRoles: [TournamentRole.CREATOR],
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

  async publishTournament(
    userId: string,
    tournamentId: number,
    unpublish: boolean = false,
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
      if (unpublish) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_UNAUTHORIZED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_UNAUTHORIZED,
          ),
          data: null,
        });
      } else {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_UNAUTHORIZED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_UNAUTHORIZED,
          ),
          data: null,
        });
      }
    }

    // Update tournament status
    try {
      await this.prismaService.tournaments.update({
        where: {
          id: tournamentId,
        },
        data: {
          phase: unpublish ? TournamentPhase.new : TournamentPhase.published,
        },
      });

      return {};
    } catch (error) {
      console.log('Error:', error.message);
      if (unpublish) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_FAILED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_FAILED,
          ),
          data: null,
        });
      } else {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_FAILED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_FAILED,
          ),
          data: null,
        });
      }
    }
  }

  async updateTournamentInfo(
    userId: string,
    tournamentId: number,
    updateDto: UpdateTournamentDto,
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

    // Check if the user is the owner of this tournament
    if (purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
        data: null,
      });
    }

    // Only allow to update tournament info when the tournament is not published (phase = new)
    if (tournament.phase !== TournamentPhase.new) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
        message:
          "Can't update tournament info when the tournament is published",
        data: null,
      });
    }

    // Validate update data (participantType and gender)
    if (updateDto.participantType) {
      if (
        updateDto.participantType === ParticipantType.single ||
        updateDto.participantType === ParticipantType.doubles
      ) {
        if (!updateDto.gender) {
          throw new BadRequestException({
            code: CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
            message: `Missing 'gender' field for 'participantType': '${updateDto.participantType}'`,
          });
        }
      } else {
        updateDto.gender = null;
      }
    } else {
      delete updateDto['gender'];
    }

    // Update tournament info
    try {
      const updatedTournament = await this.prismaService.tournaments.update({
        where: {
          id: tournamentId,
        },
        data: {
          ...updateDto,
        },
      });

      return updatedTournament;
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
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
        user1: {
          select: {
            id: true,
            image: true,
            name: true,
            elo: true,
            dob: true,
            gender: true,
            email: true,
            phoneNumber: true,
          },
        },
        message: true,
        status: true,
        appliedDate: true,
      };
    } else {
      projection = {
        user1: {
          select: {
            id: true,
            image: true,
            name: true,
            elo: true,
            dob: true,
            gender: true,
            email: true,
            phoneNumber: true,
          },
        },
        user2: {
          select: {
            id: true,
            image: true,
            name: true,
            elo: true,
            dob: true,
            gender: true,
            email: true,
            phoneNumber: true,
          },
        },
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
      // include: {
      //   user1: true,
      //   user2: true,
      //   message: true,
      //   status: true,
      //   appliedDate: true,
      // },
      select: projection,
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
        if (applicants.length < 5) {
          throw new BadRequestException({
            code: CustomResponseStatusCodes.TOURNAMENT_INVALID_NUMBER_APPLICANT,
            message: CustomResponseMessages.getMessage(
              CustomResponseStatusCodes.TOURNAMENT_INVALID_NUMBER_APPLICANT,
            ),
          });
        }
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
        user1: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            elo: true,
          },
        },
        message: true,
        status: true,
        appliedDate: true,
      };
    } else {
      conditions['select'] = {
        user1: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            elo: true,
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            elo: true,
          },
        },
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
          NOT: {
            status: RegistrationStatus.canceled,
          },
        },
        orderBy: {
          createdAt: 'desc', // Order by created_at descending (latest first)
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

    // Check if this user is the creator of the tournament -> Cannot apply to own tournament
    if (purchasedPackage.userId === userId) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANNOT_APPLY_OWN_TOURNAMENT,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_REGISTRATION_CANNOT_APPLY_OWN_TOURNAMENT,
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
  async getTournamentParticipantsCount(tournamentId: number): Promise<number> {
    return await this.prismaService.tournament_registrations.count({
      where: {
        tournamentId: tournamentId,
        NOT: {
          status: {
            in: [RegistrationStatus.canceled, RegistrationStatus.rejected],
          },
        },
      },
    });
  }

  //

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

    if (teams.length < dto.numberOfGroups * 2) {
      throw new BadRequestException({
        code: 400,
        message: 'Invalid number of groups',
      });
    }

    const groups = this.formatTournamentService.generateGroupPlayOffPhase1(
      teams.length,
      dto.numberOfGroups,
    );
    const fixtureGroups = [];
    for (let i = 0; i < groups.length; i++) {
      const teamInfo = groups[i].map((member) => {
        return teams[member - 1];
      });
      const group = {
        title: `Group ${String.fromCharCode(65 + i)}`,
        id: randomUUID(),
        numberOfProceeders: 1,
        teams: teamInfo,
      };
      fixtureGroups.push(group);
    }
    return fixtureGroups;
  }

  async generateFixture(id: number, dto: GenerateFixtureDto) {
    const tournament = await this.prismaService.tournaments.findFirst({
      where: {
        id: id,
      },
    });
    const format = tournament?.format;
    try {
      if (
        format === TournamentFormat.round_robin ||
        format === TournamentFormat.knockout
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
        if (format === TournamentFormat.round_robin) {
          const tables = this.formatTournamentService.generateTables(
            format,
            1,
            teams.length,
          );
          let k = 1;
          for (let i = 0; i < tables.table1.length; i++) {
            const matches = [];
            for (let j = 0; j < tables.table1[i].length; j++) {
              if (tables.table1[i][j] === tables.table2[i][j]) continue;

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
                title: `Match ${k++}`,
                matchStartDate: null,
                duration: dto.matchDuration,
                status: MatchStatus.scheduled,
                teams: { team1, team2 },
                refereeId: null,
                venue: dto.venue,
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
        } else if (format === TournamentFormat.knockout) {
          const tables = this.formatTournamentService.generateTables(
            format,
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
                matchStartDate: null,
                duration: dto.matchDuration,
                status: status,
                teams: { team1, team2 },
                refereeId: null,
                venue: dto.venue,
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
      if (format === TournamentFormat.group_playoff) {
        const groups = [];
        for (let i = 0; i < dto.groups.length; i++) {
          const teams = await Promise.all(
            dto.groups[i].teams.map((memberId) => {
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
                matchStartDate: null,
                duration: dto.matchDuration,
                status: MatchStatus.scheduled,
                teams: { team1, team2 },
                refereeId: null,
                venue: dto.venue,
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
            title: dto.groups[i].title,
            rounds: groupRounds,
            id: dto.groups[i].id,
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
              team1 = {
                user1: null,
                user2: null,
                name: winners[tables.table1[i][j] - 1].title,
              };
            } else {
              status = MatchStatus.skipped.toString();
            }

            if (tables.table2[i][j] !== 0 && tables.table2[i][j] !== -1) {
              groupFixtureTeamId2 = winners[tables.table2[i][j] - 1].id;
              rankGroupTeam2 = winners[tables.table2[i][j] - 1].rank;
              team2 = {
                user1: null,
                user2: null,
                name: winners[tables.table2[i][j] - 1].title,
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
              matchStartDate: null,
              duration: dto.matchDuration,
              status: status,
              teams: { team1, team2 },
              groupFixtureTeamId1,
              groupFixtureTeamId2,
              rankGroupTeam1,
              rankGroupTeam2,
              refereeId: null,
              venue: dto.venue,
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
    const format = (
      await this.prismaService.tournaments.findFirst({
        where: {
          id: id,
        },
      })
    ).format;

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
      await this.fixtureService.removeByTournamentId(id);
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
          venue: dto.venue,
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
          venue: dto.venue,
        },
      });

      if (format === TournamentFormat.round_robin) {
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
                numberOfProceeders: group.numberOfProceeders,
              },
              create: {
                id: group.id,
                fixtureId: fixture.id,
                title: group.title,
                isFinal: true,
                numberOfProceeders: group.numberOfProceeders,
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
                        matchStartDate: match.matchStartDate,
                        teamId1: match.teams.team1?.id,
                        teamId2: match.teams.team2?.id,
                        venue: match?.venue,
                        matchDuration: dto.matchDuration,
                        breakDuration: dto.breakDuration,
                        refereeId: match.refereeId,
                        groupFixtureTeamId1: match.groupFixtureTeamId1,
                        groupFixtureTeamId2: match.groupFixtureTeamId2,
                      },

                      create: {
                        id: match.id,
                        roundId: round.id,
                        title: match.title,
                        status: match.status,
                        rankGroupTeam1: match.rankGroupTeam1,
                        rankGroupTeam2: match.rankGroupTeam2,
                        nextMatchId: match.nextMatchId,
                        matchStartDate: match.matchStartDate,
                        teamId1: match.teams.team1?.id,
                        teamId2: match.teams.team2?.id,
                        venue: match.venue,
                        matchDuration: dto.matchDuration,
                        breakDuration: dto.breakDuration,
                        refereeId: match.refereeId,
                        groupFixtureTeamId1: match.groupFixtureTeamId1,
                        groupFixtureTeamId2: match.groupFixtureTeamId2,
                      },
                    });
                  }),
                );
              }),
            );
          }),
        );
      } else if (format === TournamentFormat.knockout) {
        await tx.group_fixtures.upsert({
          where: {
            id: dto.knockoutGroup.id,
          },
          update: {
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
            numberOfProceeders: dto.knockoutGroup.numberOfProceeders,
          },
          create: {
            id: dto.knockoutGroup.id,
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
            numberOfProceeders: dto.knockoutGroup.numberOfProceeders,
          },
        });
        await Promise.all(
          dto.knockoutGroup.rounds.reverse().map(async (round) => {
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
                    matchStartDate: match.matchStartDate,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.matchDuration,
                    breakDuration: dto.breakDuration,
                    refereeId: match.refereeId,
                    groupFixtureTeamId1: match.groupFixtureTeamId1,
                    groupFixtureTeamId2: match.groupFixtureTeamId2,
                  },

                  create: {
                    id: match.id,
                    roundId: round.id,
                    title: match.title,
                    status: match.status,
                    rankGroupTeam1: match.rankGroupTeam1,
                    rankGroupTeam2: match.rankGroupTeam2,
                    nextMatchId: match.nextMatchId,
                    matchStartDate: match.matchStartDate,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.matchDuration,
                    breakDuration: dto.breakDuration,
                    refereeId: match.refereeId,
                    groupFixtureTeamId1: match.groupFixtureTeamId1,
                    groupFixtureTeamId2: match.groupFixtureTeamId2,
                  },
                });
              }),
            );
          }),
        );
      } else if (format === TournamentFormat.group_playoff) {
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
                numberOfProceeders: group.numberOfProceeders,
              },
              create: {
                id: group.id,
                fixtureId: fixture.id,
                title: group.title,
                isFinal: false,
                numberOfProceeders: group.numberOfProceeders,
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
                        matchStartDate: match.matchStartDate,
                        teamId1: match.teams.team1.id,
                        teamId2: match.teams.team2.id,
                        venue: match.venue,
                        matchDuration: dto.matchDuration,
                        breakDuration: dto.breakDuration,
                        refereeId: match.refereeId,
                        groupFixtureTeamId1: match.groupFixtureTeamId1,
                        groupFixtureTeamId2: match.groupFixtureTeamId2,
                      },

                      create: {
                        id: match.id,
                        roundId: round.id,
                        title: match.title,
                        status: match.status,
                        rankGroupTeam1: match.rankGroupTeam1,
                        rankGroupTeam2: match.rankGroupTeam2,
                        nextMatchId: match.nextMatchId,
                        matchStartDate: match.matchStartDate,
                        teamId1: match.teams.team1.id,
                        teamId2: match.teams.team2.id,
                        venue: match.venue,
                        matchDuration: dto.matchDuration,
                        breakDuration: dto.breakDuration,
                        refereeId: match.refereeId,
                        groupFixtureTeamId1: match.groupFixtureTeamId1,
                        groupFixtureTeamId2: match.groupFixtureTeamId2,
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
            numberOfProceeders: dto.knockoutGroup.numberOfProceeders,
          },
          create: {
            id: dto.knockoutGroup.id,
            fixtureId: fixture.id,
            title: dto.knockoutGroup.title,
            isFinal: true,
            numberOfProceeders: dto.knockoutGroup.numberOfProceeders,
          },
        });
        await Promise.all(
          dto.knockoutGroup.rounds.reverse().map(async (round) => {
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
                    matchStartDate: match.matchStartDate,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.matchDuration,
                    breakDuration: dto.breakDuration,
                    refereeId: match.refereeId,
                    groupFixtureTeamId1: match.groupFixtureTeamId1,
                    groupFixtureTeamId2: match.groupFixtureTeamId2,
                  },

                  create: {
                    id: match.id,
                    roundId: round.id,
                    title: match.title,
                    status: match.status,
                    rankGroupTeam1: match.rankGroupTeam1,
                    rankGroupTeam2: match.rankGroupTeam2,
                    nextMatchId: match.nextMatchId,
                    matchStartDate: match.matchStartDate,
                    teamId1: match.teams.team1?.id,
                    teamId2: match.teams.team2?.id,
                    venue: match.venue,
                    matchDuration: dto.matchDuration,
                    breakDuration: dto.breakDuration,
                    refereeId: match.refereeId,
                    groupFixtureTeamId1: match.groupFixtureTeamId1,
                    groupFixtureTeamId2: match.groupFixtureTeamId2,
                  },
                });
              }),
            );
          }),
        );

        //update teams
        await Promise.all(
          dto.groups.map(async (group) => {
            await tx.teams.updateMany({
              where: {
                id: {
                  in: group.teams,
                },
              },
              data: {
                groupFixtureId: group.id,
              },
            });
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
                      groupFixture1: true,
                      groupFixture2: true,
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
                      referee: {
                        select: {
                          id: true,
                          image: true,
                          name: true,
                          dob: true,
                          phoneNumber: true,
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
          const { team1, team2, groupFixture1, groupFixture2, ...others } =
            match;
          let team1R = null,
            team2R = null;
          if (
            team1 === null &&
            !match.rankGroupTeam1 != null &&
            groupFixture1 != null
          ) {
            team1R = {
              user1: null,
              user2: null,
              name: `Winner ${match.rankGroupTeam1} of ${groupFixture1.title}`,
            };
          }
          if (
            team2 === null &&
            match.rankGroupTeam2 != null &&
            groupFixture2 != null
          ) {
            team2R = {
              user1: null,
              user2: null,
              name: `Winner ${match.rankGroupTeam2} of ${groupFixture2.title}`,
            };
          }
          return {
            ...others,
            teams: { team1: team1 || team1R, team2: team2 || team2R },
          };
        });
        return { ...round, matches: matches };
      });
      return { ...groupFixture, rounds: rounds };
    });
    if (format === TournamentFormat.round_robin) {
      return { ...others, roundRobinGroups: groups };
    } else if (format === TournamentFormat.knockout) {
      groups[0].rounds.reverse();
      return { ...others, knockoutGroup: groups[0] };
    } else if (format === TournamentFormat.group_playoff) {
      groups[0].rounds.reverse();
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
                    referee: {
                      select: {
                        id: true,
                        image: true,
                        name: true,
                        dob: true,
                        phoneNumber: true,
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

  async getAllTeams(
    tournamentId: number,
    pageOptions: PageOptionsTournamentDto,
  ) {
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.teams.findMany({
        ...conditions,
        ...pageOption,
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
      }),
      this.prismaService.teams.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
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
