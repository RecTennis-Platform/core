import { Injectable } from '@nestjs/common';
import { Order } from 'constants/order';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MatchService {
  constructor(private readonly prismaService: PrismaService) {}

  // Matches
  async getMatchDetails(matchId: string) {
    // Get match details with populated relations (sets, games, scores)
    // Build populate conditions
    const conditions = {
      where: {
        id: matchId,
      },
      select: {
        // Team 1
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
        // Team 2
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
      },
    };

    // Get match details
    const matchDetails = await this.prismaService.matches.findFirst(conditions);

    // Modify match data
    // Modify sets
    matchDetails.sets = await Promise.all(
      matchDetails.sets.map(async (set) => {
        // Set final score
        const setFinalScore = {
          team1: set.team1SetScore,
          team2: set.team2SetScore,
          tieBreak: null,
        };

        // If this set has tiebreak
        if (set.isTieBreak) {
          // Get tiebreak score
          const tieBreakScore = await this.getTieBreakScore(set.id);

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

    // Add matchFinalScore (Max 3 sets, win 2 sets -> win match)
    // Team 1 win sets
    const team1WinSets = await this.getWinSetsOfTeam(
      matchDetails.id,
      matchDetails.teamId1,
    );

    // console.log('team1WinSets:', team1WinSets);

    // Team 2 win sets
    const team2WinSets = await this.getWinSetsOfTeam(
      matchDetails.id,
      matchDetails.teamId2,
    );

    // console.log('team2WinSets:', team2WinSets);

    const matchFinalScore = {
      team1: team1WinSets.length,
      team2: team2WinSets.length,
      teamWinnerId: matchDetails.teamWinnerId,
    };

    // console.log('matchFinalScore:', matchFinalScore);

    // Remove unnecessary data
    delete matchDetails.teamId1;
    delete matchDetails.teamId2;

    matchDetails['matchFinalScore'] = matchFinalScore;

    return matchDetails;
  }

  // Utils
  async getTieBreakScore(setId: number) {
    // Get tie break game
    const tieBreakGame = await this.prismaService.games.findFirst({
      where: {
        setId: setId,
        isTieBreak: true,
      },
      orderBy: {
        id: Order.DESC,
      },
    });

    // Get tie break score
    const tieBreakScore = await this.prismaService.scores.findFirst({
      where: {
        gameId: tieBreakGame.id,
      },
      orderBy: {
        id: Order.DESC,
      },
      select: {
        team1Score: true,
        team2Score: true,
      },
    });

    return tieBreakScore;
  }

  async getWinSetsOfTeam(matchId: string, teamId: string) {
    return await this.prismaService.sets.findMany({
      where: {
        matchId: matchId,
        teamWinId: teamId,
      },
    });
  }
}
