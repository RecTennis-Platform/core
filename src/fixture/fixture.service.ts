import { Injectable } from '@nestjs/common';
import { CreateFixtureDto } from './dto/create-fixture.dto';
import { UpdateFixtureDto } from './dto/update-fixture.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { TournamentFormat } from '@prisma/client';

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
    await this.prismaService.fixtures.deleteMany({
      where: {
        tournamentId: tournamentId,
      },
    });
    return { message: 'success' };
  }

  async getByTournamentId(tournamentId: number) {
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
        },
        tournament: true,
      },
    });
    if (!fixture) {
      return {
        status: 'new',
      };
    }
    const { groupFixtures, tournament, ...others } = fixture;
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
    if (tournament.format === TournamentFormat.round_robin) {
      return { ...others, roundRobinGroups: groups };
    } else if (tournament.format === TournamentFormat.knockout) {
      groups[0].rounds.reverse();
      return { ...others, knockoutGroup: groups[0] };
    } else if (tournament.format === TournamentFormat.group_playoff) {
      groups[0].rounds.reverse();
      const knockoutGroup = groups[0];
      const roundRobinGroups = (
        await this.prismaService.group_fixtures.findMany({
          where: {
            isFinal: false,
            fixtureId: others.id,
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
}
