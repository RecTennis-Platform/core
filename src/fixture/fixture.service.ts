import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateFixtureDto } from './dto/create-fixture.dto';
import { UpdateFixtureDto } from './dto/update-fixture.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { TournamentFormat, TournamentPhase } from '@prisma/client';
import { CustomResponseStatusCodes } from 'src/helper/custom-response-status-code';
import { CustomResponseMessages } from 'src/helper/custom-response-message';

@Injectable()
export class FixtureService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}
  create(createFixtureDto: CreateFixtureDto) {
    return 'This action adds a new fixture';
  }

  findAll() {
    return `This action returns all fixture`;
  }

  findOne(id: string) {
    return `This action returns a #${id} fixture`;
  }

  update(id: number, updateFixtureDto: UpdateFixtureDto) {
    return `This action updates a #${id} fixture`;
  }

  async remove(id: string) {
    return this.prismaService.fixtures.delete({
      where: {
        id: id,
      },
    });
  }

  async removeByTournamentId(tournamentId: number) {
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        groupFixtures: true,
      },
    });
    if (!fixture) {
      throw new NotFoundException({
        message: 'Fixture not found',
      });
    }
    for (const groupFixture of fixture.groupFixtures) {
      await this.prismaService.teams.updateMany({
        where: {
          groupFixtureId: groupFixture.id,
        },
        data: {
          groupFixtureId: null,
        },
      });
    }

    await this.prismaService.fixtures.deleteMany({
      where: {
        tournamentId: tournamentId,
      },
    });
    return { message: 'success' };
  }

  async removeByTournamentIdIdempontent(tournamentId: number) {
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        groupFixtures: true,
      },
    });
    if (fixture) {
      for (const groupFixture of fixture.groupFixtures) {
        await this.prismaService.teams.updateMany({
          where: {
            groupFixtureId: groupFixture.id,
          },
          data: {
            groupFixtureId: null,
          },
        });
      }

      await this.prismaService.fixtures.deleteMany({
        where: {
          tournamentId: tournamentId,
        },
      });
    }
  }

  async removeByGroupTournamentIdIdempontent(tournamentId: number) {
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        groupTournamentId: tournamentId,
      },
      select: {
        groupFixtures: true,
      },
    });
    if (fixture) {
      for (const groupFixture of fixture.groupFixtures) {
        await this.prismaService.teams.updateMany({
          where: {
            groupFixtureId: groupFixture.id,
          },
          data: {
            groupFixtureId: null,
          },
        });
      }

      await this.prismaService.fixtures.deleteMany({
        where: {
          groupTournamentId: tournamentId,
        },
      });
    }
  }

  async removeKnockoutGroupFixtureByTournamentIdIdempontent(
    tournamentId: number,
  ) {
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        groupFixtures: {
          where: {
            isFinal: true,
          },
        },
        id: true,
      },
    });
    if (fixture) {
      for (const groupFixture of fixture.groupFixtures) {
        await this.prismaService.teams.updateMany({
          where: {
            groupFixtureId: groupFixture.id,
          },
          data: {
            groupFixtureId: null,
          },
        });
      }
      if (fixture.groupFixtures.length > 0) {
        await this.prismaService.group_fixtures.deleteMany({
          where: {
            fixtureId: fixture.id,
            isFinal: true,
          },
        });
      }
    }
  }

  async getByTournamentId(tournamentId: number, userId: string) {
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
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        tournamentId: tournamentId,
      },
      include: {
        groupFixtures: {
          where: {
            isFinal: true,
          },
          include: {
            rounds: {
              orderBy: {
                title: 'asc',
              },
              include: {
                matches: {
                  orderBy: {
                    title: 'asc',
                  },
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
        tournament: true,
      },
    });
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
    if (isCreator) {
      if (tournament.phase === TournamentPhase.new) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          ),
          data: null,
        });
      }
      if (!fixture) {
        return {
          status: 'new',
        };
      }
    } else if (
      tournament.phase === TournamentPhase.new ||
      tournament.phase === TournamentPhase.finalized_applicants
    ) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
        ),
        data: null,
      });
    }
    if (!fixture) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.FIXTURE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.FIXTURE_NOT_FOUND,
        ),
        data: null,
      });
    }
    const { groupFixtures, ...others } = fixture;
    const followMatches = (
      await this.prismaService.users_follow_matches.findMany({
        where: {
          userId: userId,
        },
        select: {
          matchId: true,
        },
      })
    ).map((followMatch) => followMatch.matchId);
    let groups = null;
    if (groupFixtures.length > 0) {
      groups = groupFixtures.map((groupFixture) => {
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
              isFollowed: followMatches.includes(others.id),
              teams: { team1: team1 || team1R, team2: team2 || team2R },
            };
          });
          return { ...round, matches: matches };
        });
        return { ...groupFixture, rounds: rounds };
      });
    }

    if (tournament.format === TournamentFormat.round_robin) {
      return {
        ...others,
        roundRobinGroups: groups,
        format: tournament.format,
        isFollowed: followMatches.includes(others.id),
      };
    } else if (tournament.format === TournamentFormat.knockout) {
      //groups[0].rounds.reverse();
      return {
        ...others,
        knockoutGroup: groups[0],
        format: tournament.format,
        isFollowed: followMatches.includes(others.id),
      };
    } else if (tournament.format === TournamentFormat.group_playoff) {
      let knockoutGroup = null;
      if (groups) {
        //groups[0].rounds.reverse();
        knockoutGroup = groups[0];
      }

      const fixtureGroups = [];
      const roundRobinGroups = (
        await this.prismaService.group_fixtures.findMany({
          where: {
            isFinal: false,
            fixtureId: others.id,
          },
          include: {
            rounds: {
              orderBy: {
                title: 'asc',
              },
              include: {
                matches: {
                  orderBy: {
                    title: 'asc',
                  },
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
            teams: {
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
        })
      ).map((groupFixture) => {
        const { id, title, numberOfProceeders, teams } = groupFixture;
        fixtureGroups.push({
          id,
          title,
          numberOfProceeders,
          teams,
        });
        const rounds = groupFixture.rounds.map((round) => {
          const matches = round.matches.map((match) => {
            const { team1, team2, ...others } = match;
            return {
              ...others,
              teams: { team1, team2 },
              isFollowed: followMatches.includes(others.id),
            };
          });
          return { ...round, matches: matches };
        });
        return { ...groupFixture, rounds: rounds };
      });
      return {
        ...others,
        format: tournament.format,
        knockoutGroup,
        roundRobinGroups,
        groups: fixtureGroups,
      };
    }
  }
}
