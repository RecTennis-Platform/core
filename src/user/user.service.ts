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
import { MatchService } from 'src/match/match.service';
import { Order } from 'constants/order';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly tournamentService: TournamentService,
    private readonly matchService: MatchService,
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
        isReferee: true,
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
        isReferee: true,
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
      params: JSON.stringify({
        matchId: '5065e45d-39a8-4cf4-83d3-ff520444c121',
      }),
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
    const userParticipatedTournaments = result
      .map((registration) => {
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
      })
      .filter(Boolean);

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

  async getMyParticipatedGroupTournaments(
    userId: string,
    pageOptions: PageOptionsUserParticipatedTournamentsDto,
    groupId: number,
  ) {
    // Build pagination options

    const tournaments = await this.prismaService.group_tournaments.findMany({
      where: {
        groupId: groupId,
      },
    });

    const tournamentIds = tournaments.map((tournament) => {
      return tournament.id;
    });
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        userId: userId,
        groupTournamentId: { in: tournamentIds },
      },
      select: {
        groupTournament: true,
      },
    };

    // Check if status is provided
    if (pageOptions.status) {
      conditions.where['groupTournament'] = {
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
      this.prismaService.group_tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.group_tournament_registrations.count({
        where: conditions.where,
      }),
    ]);

    // Map to get only tournament details
    const userParticipatedTournaments = result
      .map((registration) => {
        return {
          ...registration.groupTournament,
        };
      })
      .filter(Boolean);

    // Get each tournament participants count
    for (const tournament of userParticipatedTournaments) {
      tournament['participants'] = await this.getTournamentParticipantsCount(
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

  async unFollowMatch(userId: string, matchId: string) {
    try {
      await this.prismaService.users_follow_matches.deleteMany({
        where: {
          userId: userId,
          matchId: matchId,
        },
      });
      return {
        message: 'Unfollow match successfully',
      };
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
        include: {
          match: {
            include: {
              team1: {
                include: {
                  user1: {
                    select: {
                      id: true,
                      image: true,
                      name: true,
                      isReferee: true,
                    },
                  },
                  user2: {
                    select: {
                      id: true,
                      image: true,
                      name: true,
                      isReferee: true,
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
                      isReferee: true,
                    },
                  },
                  user2: {
                    select: {
                      id: true,
                      image: true,
                      name: true,
                      isReferee: true,
                    },
                  },
                },
              },
            },
          },
        },
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
  ): Promise<any> {
    // Build pagination options
    const conditions = {
      where: {
        refereeId: userId,
      },
      orderBy: {
        matchStartDate: Order.ASC,
      },
      select: {
        // Team 1
        team1: {
          select: {
            id: true,
            user1: {
              select: {
                id: true,
                name: true,
                image: true,
                isReferee: true,
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                image: true,
                isReferee: true,
              },
            },
          },
        },
        // Team 2
        team2: {
          select: {
            id: true,
            user1: {
              select: {
                id: true,
                name: true,
                image: true,
                isReferee: true,
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                image: true,
                isReferee: true,
              },
            },
          },
        },
        // Sets
        sets: {
          orderBy: {
            id: Order.DESC,
          },
          select: {
            id: true,
            team1SetScore: true,
            team2SetScore: true,
            isTieBreak: true,
            status: true,
            teamWinId: true,
            setStartTime: true,
            // Games
            games: {
              orderBy: {
                id: Order.DESC,
              },
              select: {
                id: true,
                teamWinId: true,
                scores: {
                  orderBy: {
                    id: Order.DESC,
                  },
                  select: {
                    id: true,
                    type: true,
                    team1Score: true,
                    team2Score: true,
                    teamWinId: true,
                    time: true,
                  },
                },
              },
            },
          },
        },
        // Other match details
        id: true,
        teamId1: true,
        teamId2: true,
        status: true,
        venue: true,
        teamWinnerId: true,
        matchStartDate: true,
        matchEndDate: true,
        team1MatchScore: true,
        team2MatchScore: true,
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

    // Modify match data
    const modifiedData = await Promise.all(
      result.map(async (match) => {
        // Modify sets
        match.sets = await Promise.all(
          match.sets.map(async (set) => {
            // Set final score
            const setFinalScore = {
              team1: set.team1SetScore,
              team2: set.team2SetScore,
              tieBreak: null,
            };

            // If this set has tiebreak
            if (set.isTieBreak) {
              // Get tiebreak score
              const tieBreakScore = await this.matchService.getTieBreakScore(
                set.id,
              );

              // console.log('tieBreakScore:', tieBreakScore);

              setFinalScore.tieBreak = {
                team1: tieBreakScore.team1Score,
                team2: tieBreakScore.team2Score,
              };
            }

            // Remove unnecessary data
            delete set.team1SetScore;
            delete set.team2SetScore;

            return {
              ...set,
              setFinalScore,
            };
          }),
        );

        // matchFinalScore (Max 3 sets, win 2 sets -> win match)
        // Team 1 win sets
        // const team1WinSets = await this.matchService.getWinSetsOfTeam(
        //   match.id,
        //   match.teamId1,
        // );

        // console.log('team1WinSets:', team1WinSets);

        // Team 2 win sets
        // const team2WinSets = await this.matchService.getWinSetsOfTeam(
        //   match.id,
        //   match.teamId2,
        // );

        // console.log('team2WinSets:', team2WinSets);

        const matchFinalScore = {
          team1: match.team1MatchScore,
          team2: match.team2MatchScore,
          teamWinnerId: match.teamWinnerId,
        };

        // console.log('matchFinalScore:', matchFinalScore);

        // Remove unnecessary data
        delete match.teamId1;
        delete match.teamId2;

        return {
          ...match,
          matchFinalScore,
        };
      }),
    );

    // console.log('modifiedData:', modifiedData);

    return {
      data: modifiedData,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }
  // Utils
  async getTournamentParticipantsCount(tournamentId: number): Promise<number> {
    const participantCountUser1 =
      await this.prismaService.group_tournament_registrations.count({
        where: {
          groupTournamentId: tournamentId,
        },
      });

    const participantCount = participantCountUser1;
    return participantCount;
  }
}
