import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateAdminAccountDto,
  PageOptionsRefereeMatchesDto,
  PageOptionsUserFollowedMatchesDto,
  PageOptionsUserParticipatedTournamentsDto,
  UpdateUserAccountDto,
} from './dto';
import { RegistrationStatus, TournamentStatus, UserRole } from '@prisma/client';
import { CustomResponseStatusCodes } from 'src/helper/custom-response-status-code';
import { CustomResponseMessages } from 'src/helper/custom-response-message';
import { TournamentService } from 'src/tournament/tournament.service';
import { FcmNotificationService } from 'src/services/notification/fcm-notification';
import { TournamentModule } from 'src/tournament/tournament.module';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tournamentService: TournamentService,
    private readonly fcmNotificationService: FcmNotificationService,
  ) {}

  async getUserDetails(userId: string): Promise<any> {
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        dob: true,
        phoneNumber: true,
        gender: true,
        role: true,
        elo: true,
        fcmToken: true,
      },
    });

    if (!user) {
      throw new BadRequestException({
        message: 'Unauthorized',
        data: null,
      });
    }

    return user;
  }

  async createAdminAccount(dto: CreateAdminAccountDto): Promise<{
    message: string;
    data: any;
  }> {
    try {
      // Hash password
      const hash = await argon.hash(process.env.DEFAULT_ADMIN_PASSWORD);

      // Create account
      await this.prismaService.users.create({
        data: {
          ...dto,
          password: hash,
          role: UserRole.admin,
          image: null,
        },
      });

      return {
        message: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);

      if (err.code === 'P2002') {
        throw new BadRequestException({
          message: 'Email already exists',
          data: null,
        });
      }

      throw new InternalServerErrorException({
        message: 'Error creating admin account',
        data: null,
      });
    }
  }

  async getAllUsers(): Promise<{
    message: string;
    data: any;
  }> {
    const users = await this.prismaService.users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
      },
    });

    if (users.length === 0) {
      throw new NotFoundException({
        message: 'No users found',
        data: [],
      });
    }

    return {
      message: 'success',
      data: users,
    };
  }

  async updateUserDetails(
    userId: string,
    dto: UpdateUserAccountDto,
  ): Promise<{
    message: string;
    data: any;
  }> {
    // Check if user exists
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        data: null,
      });
    }

    try {
      // Update user details
      await this.prismaService.users.update({
        where: {
          id: userId,
        },
        data: {
          ...dto,
        },
      });

      return {
        message: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new InternalServerErrorException({
        message: 'Error updating user details',
        data: null,
      });
    }
  }

  async testNotification(userId: string) {
    // Check if user exists
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        data: null,
      });
    }
    if (!user.fcmToken) {
      throw new BadRequestException({
        message: 'User does not have fcm token',
        data: null,
      });
    }
    const token = user.fcmToken;
    const data = {
      params: JSON.stringify({ matchId: 1 }),
      type: 'MATCH_UPDATE',
    };
    const notification = {
      title: 'Test Notification',
      body: 'This is a test message',
    };
    return this.fcmNotificationService.sendingNotificationOneUser(
      token,
      data,
      notification,
    );
  }

  async getMyParticipatedTournaments(
    userId: string,
    pageOptions: PageOptionsUserParticipatedTournamentsDto,
  ) {
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        OR: [{ userId1: { equals: userId } }, { userId2: { equals: userId } }],
        NOT: {
          status: RegistrationStatus.canceled,
        },
      },
      select: {
        status: true,
        tournament: true,
      },
    };

    // Check if status is provided
    if (pageOptions.status) {
      conditions.where['tournament'] = {
        status: {
          equals: pageOptions.status,
        },
      };
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get user's tournament registrations
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournament_registrations.count({
        where: conditions.where,
      }),
    ]);

    // Map to get only tournament details
    const userParticipatedTournaments = result.map((registration) => {
      if (registration.status !== RegistrationStatus.rejected) {
        return {
          ...registration.tournament,
          applicationStatus: registration.status,
        };
      } else {
        if (registration.tournament.status === TournamentStatus.upcoming) {
          return {
            ...registration.tournament,
            applicationStatus: registration.status,
          };
        }
      }
    });

    // Get each tournament participants count
    for (const tournament of userParticipatedTournaments) {
      tournament['participants'] =
        await this.tournamentService.getTournamentParticipantsCount(
          tournament.id,
        );
    }

    return {
      data: userParticipatedTournaments,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async getUserParticipatedTournaments(
    userId: string,
    pageOptions: PageOptionsUserParticipatedTournamentsDto,
  ) {
    // Check if user exists
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.USER_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.USER_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        tournament: {
          status: TournamentStatus.completed,
        },
        OR: [{ userId1: { equals: userId } }, { userId2: { equals: userId } }],
      },
      select: {
        tournament: true,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get user's tournament registrations
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournament_registrations.count({
        where: conditions.where,
      }),
    ]);

    // Map to get only tournament details
    const userParticipatedTournaments = result.map(
      (registration) => registration.tournament,
    );

    return {
      data: userParticipatedTournaments,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async followMatch(userId: string, matchId: string) {
    try {
      return await this.prismaService.users_follow_matches.create({
        data: {
          userId: userId,
          matchId: matchId,
        },
      });
    } catch (err) {
      console.log('Error:', err.message);

      throw new InternalServerErrorException({
        message: err.message,
      });
    }
  }

  async getUserFollowedMatches(
    userId: string,
    pageOptions: PageOptionsUserFollowedMatchesDto,
  ) {
    // Check if user exists
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.USER_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.USER_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        userId: userId,
      },
      select: {
        match: true,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get user's tournament registrations
    const [result, totalCount] = await Promise.all([
      this.prismaService.users_follow_matches.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.users_follow_matches.count({
        where: conditions.where,
      }),
    ]);

    const matches = result.map((r) => r.match);

    return {
      data: matches,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  // Referee
  async getRefereeMatches(
    userId: string,
    pageOptions: PageOptionsRefereeMatchesDto,
  ) {
    // Build pagination options
    const conditions = {
      where: {
        refereeId: userId,
      },
      select: {
        team1: {
          select: {
            user1: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        team2: {
          select: {
            user1: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        sets: {
          select: {
            status: true,
            teamWinId: true,
            setStartTime: true,
          },
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

    // Get referee's matches
    const [result, totalCount] = await Promise.all([
      this.prismaService.matches.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.matches.count({
        where: conditions.where,
      }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }
}
