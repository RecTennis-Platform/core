import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, ScoreType, SetStatus } from '@prisma/client';
import { Order } from 'constants/order';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateScoreDto } from './dto';
import { reverseScoreMap, scoreMap } from './constanst';
import { NotificationProducer } from 'src/services/notification/notification-producer';
import { UpdateMatchDto } from './dto/update-match.dto';
import { CustomResponseStatusCodes } from 'src/helper/custom-response-status-code';
import { CustomResponseMessages } from 'src/helper/custom-response-message';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class MatchService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationProducer: NotificationProducer,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}

  // Matches
  async getMatchDetails(matchId: string, userId: string) {
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
            id: true,
            totalElo: true,
            user1: {
              select: {
                id: true,
                name: true,
                image: true,
                elo: true,
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                image: true,
                elo: true,
              },
            },
          },
        },
        // Team 2
        team2: {
          select: {
            id: true,
            totalElo: true,
            user1: {
              select: {
                id: true,
                name: true,
                image: true,
                elo: true,
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                image: true,
                elo: true,
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
                // Scores
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
                    teamServeId: true,
                    time: true,
                  },
                },
              },
            },
          },
        },
        // Other match details
        id: true,
        title: true,
        teamId1: true,
        teamId2: true,
        status: true,
        venue: true,
        teamWinnerId: true,
        matchStartDate: true,
        refereeMatchStartDate: true,
        matchEndDate: true,
        team1MatchScore: true,
        team2MatchScore: true,
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
    // // Team 1 win sets
    // const team1WinSets = await this.getWinSetsOfTeam(
    //   matchDetails.id,
    //   matchDetails.teamId1,
    // );

    // // console.log('team1WinSets:', team1WinSets);

    // // Team 2 win sets
    // const team2WinSets = await this.getWinSetsOfTeam(
    //   matchDetails.id,
    //   matchDetails.teamId2,
    // );

    // // console.log('team2WinSets:', team2WinSets);

    const matchFinalScore = {
      team1: matchDetails.team1MatchScore,
      team2: matchDetails.team2MatchScore,
      teamWinnerId: matchDetails.teamWinnerId,
    };

    // console.log('matchFinalScore:', matchFinalScore);

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

    // Remove unnecessary data
    delete matchDetails.teamId1;
    delete matchDetails.teamId2;

    matchDetails['matchFinalScore'] = matchFinalScore;
    matchDetails['isFollowed'] = followMatches.includes(matchId);

    return matchDetails;
  }

  async startMatch(matchId: string, refereeId: string, teamServeId: string) {
    // Validate if referee is assigned to this match
    const assignedMatch = await this.prismaService.matches.findUnique({
      where: {
        id: matchId,
        refereeId: refereeId,
      },
      include: {
        round: {
          include: {
            fixture: {
              include: {
                fixture: {
                  include: {
                    tournament: true,
                    groupTournament: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignedMatch) {
      throw new BadRequestException('Referee is not assigned to this match');
    }

    // Check match status
    if (assignedMatch.status !== MatchStatus.scheduled) {
      throw new BadRequestException(
        `Match status is '${assignedMatch.status}'`,
      );
    }

    const today = new Date();

    const isTodayMatchStartDate =
      today.getFullYear() === assignedMatch.matchStartDate.getFullYear() &&
      today.getMonth() === assignedMatch.matchStartDate.getMonth() &&
      today.getDate() === assignedMatch.matchStartDate.getDate();
    if (!isTodayMatchStartDate) {
      throw new BadRequestException(`MatchStartDate must be today`);
    }

    try {
      // Create new set
      const newSet = await this.prismaService.sets.create({
        data: {
          matchId: matchId,
          status: SetStatus.on_going,
        },
      });

      // Create new game
      const newGame = await this.prismaService.games.create({
        data: {
          setId: newSet.id,
        },
      });

      // Creat init score (0 - 0)
      await this.prismaService.scores.create({
        data: {
          gameId: newGame.id,
          teamServeId: teamServeId,
        },
      });

      // Update match status (scheduled -> walk_over)
      await this.prismaService.matches.update({
        where: {
          id: matchId,
        },
        data: {
          status: MatchStatus.walk_over,
          refereeMatchStartDate: new Date(),
        },
      });

      const userIds = [];
      let otherParams, type;
      if (assignedMatch.round.fixture.fixture.tournamentId) {
        const participants = await this.prismaService.teams.findMany({
          where: {
            tournamentId: assignedMatch.round.fixture.fixture.tournamentId,
          },
        });

        participants.forEach((participant) => {
          if (participant.userId1) {
            userIds.push(participant.userId1);
          }
          if (participant.userId2) {
            userIds.push(participant.userId2);
          }
        });
        otherParams = {
          tournamentId: assignedMatch.round.fixture.fixture.tournamentId,
        };
        if (assignedMatch.teamId1 && assignedMatch.teamId2) {
          type = 'tournament_matches_on_going';
        } else {
          type = 'tournament_matches_schedule';
        }
      } else {
        const participants = await this.prismaService.teams.findMany({
          where: {
            groupTournamentId:
              assignedMatch.round.fixture.fixture.groupTournamentId,
          },
        });

        participants.forEach((participant) => {
          if (participant.userId1) {
            userIds.push(participant.userId1);
          }
          if (participant.userId2) {
            userIds.push(participant.userId2);
          }
        });
        otherParams = {
          groupTournamentId:
            assignedMatch.round.fixture.fixture.groupTournamentId,
        };
        if (assignedMatch.teamId1 && assignedMatch.teamId2) {
          type = 'group_tournament_matches_on_going';
        } else {
          type = 'group_tournament_matches_schedule';
        }
      }

      const followUsers = (
        await this.prismaService.users_follow_matches.findMany({
          where: {
            matchId: matchId,
          },
          select: {
            userId: true,
          },
        })
      ).map((user) => {
        return user.userId;
      });
      const notification = {
        title: 'Match Beginning',
        body: 'The match you are following has just started! Tune in now to catch the action.',
      };
      const notiData = {
        mobileType: 'MATCH_UPDATE',
        type,
        params: {
          matchId: matchId,
          ...otherParams,
        },
        notification,
        web: true,
        mobile: true,
      };
      const notificationData = {
        userIds: [...new Set(followUsers.concat(userIds))],
        notiData,
      };
      await this.notificationProducer.add(notificationData);

      return await this.getMatchDetails(matchId, refereeId);
    } catch (err) {
      throw new InternalServerErrorException({
        message: `Error: ${err.message}`,
      });
    }
  }

  async startSet(matchId: string, refereeId: string) {
    // Validate if referee is assigned to this match
    const assignedMatch = await this.prismaService.matches.findUnique({
      where: {
        id: matchId,
        refereeId: refereeId,
      },
    });

    if (!assignedMatch) {
      throw new BadRequestException('Referee is not assigned to this match');
    }

    // Check match status (== 'walk_over')
    if (assignedMatch.status !== MatchStatus.walk_over) {
      throw new BadRequestException(
        `Match must be started and in progress - 'walk_over'. Match status is '${assignedMatch.status}'`,
      );
    }

    // Get current set (current set's status == 'not_started', teamWinId = null)
    const currentSet = await this.prismaService.sets.findFirst({
      where: {
        matchId: matchId,
        status: SetStatus.not_started,
      },
    });

    if (!currentSet) {
      throw new BadRequestException('Set not found');
    }

    try {
      // Update set status (not_started -> on_going)
      await this.prismaService.sets.update({
        where: {
          id: currentSet.id,
        },
        data: {
          status: SetStatus.on_going,
          setStartTime: new Date(),
        },
      });

      // Create new game
      const newGame = await this.prismaService.games.create({
        data: {
          setId: currentSet.id,
        },
      });

      // Creat init score (0 - 0)
      await this.prismaService.scores.create({
        data: {
          gameId: newGame.id,
        },
      });

      return await this.getMatchDetails(matchId, refereeId);
    } catch (err) {
      throw new InternalServerErrorException({
        message: `Error: ${err.message}`,
      });
    }
  }

  async updateScore(matchId: string, refereeId: string, dto: UpdateScoreDto) {
    // Validate if referee is assigned to this match
    const assignedMatch = await this.prismaService.matches.findUnique({
      where: {
        id: matchId,
        refereeId: refereeId,
      },
      include: {
        team1: {
          include: {
            user1: true,
            user2: true,
          },
        },
        team2: {
          include: {
            user1: true,
            user2: true,
          },
        },
      },
    });

    if (!assignedMatch) {
      throw new BadRequestException('Referee is not assigned to this match');
    }

    // Check match status (== 'walk_over')
    if (assignedMatch.status !== MatchStatus.walk_over) {
      throw new BadRequestException(
        `Match must be in progress - 'walk_over'. Match status is '${assignedMatch.status}'`,
      );
    }

    // Get current active set
    const activeSet = await this.prismaService.sets.findFirst({
      where: {
        matchId: matchId,
        status: SetStatus.on_going,
        teamWinId: null,
      },
      orderBy: {
        id: Order.DESC,
      },
    });

    // No active set (set.status != 'on_going')
    if (!activeSet) {
      throw new BadRequestException(`No active set for match ${matchId}`);
    }

    // Get current active game
    const activeGame = await this.prismaService.games.findFirst({
      where: {
        setId: activeSet.id,
        teamWinId: null,
      },
      orderBy: {
        id: Order.DESC,
      },
    });

    if (!activeGame) {
      throw new BadRequestException(`No active game for set ${activeSet.id}`);
    }

    // Get current active score
    const activeScore = await this.prismaService.scores.findFirst({
      where: {
        gameId: activeGame.id,
      },
      orderBy: {
        id: Order.DESC,
      },
    });

    if (!activeScore) {
      throw new BadRequestException(`No score for game ${activeGame.id}`);
    }

    // Check valid score type (!== 'init')
    if (dto.type === ScoreType.init) {
      throw new BadRequestException(`Invalid score type: '${dto.type}'`);
    }

    // Check valid teamWin
    if (![1, 2].includes(dto.teamWin)) {
      throw new BadRequestException(
        `Invalid teamWin value: '${dto.teamWin}'. Only 1 or 2`,
      );
    }

    // // Check valid teamServeId -> teamId1 or teamId2
    // if (
    //   ![assignedMatch.teamId1, assignedMatch.teamId2].includes(dto.teamServeId)
    // ) {
    //   throw new BadRequestException(
    //     `Invalid teamServeId value: '${dto.teamServeId}'. Must be teamId1 or teamId2`,
    //   );
    // }

    let isGameEnd = false;

    // Calculate score time (Current time - gameStartTime)
    const scoreTime = this.calculateTimeDifference(
      activeGame.gameStartTime,
      new Date(),
    );

    console.log('scoreTime:', scoreTime);

    console.log('activeScore.team1Score', activeScore.team1Score);
    console.log('activeScore.team2Score', activeScore.team2Score);

    console.log('activeScore.team1Score', typeof activeScore.team1Score);
    console.log('activeScore.team2Score', typeof activeScore.team2Score);

    // Get current score
    let teamWinScore = 0;
    let teamLoseScore = 0;
    if (dto.teamWin === 1) {
      if (activeGame.isTieBreak) {
        // Tie break game score
        teamWinScore = parseInt(activeScore.team1Score) + 1;
        teamLoseScore = parseInt(activeScore.team2Score);
      } else {
        // Normal game score
        teamWinScore = reverseScoreMap[activeScore.team1Score] + 1;
        teamLoseScore = reverseScoreMap[activeScore.team2Score];
      }
    } else {
      if (activeGame.isTieBreak) {
        teamWinScore = parseInt(activeScore.team2Score) + 1;
        teamLoseScore = parseInt(activeScore.team1Score);
      } else {
        teamWinScore = reverseScoreMap[activeScore.team2Score] + 1;
        teamLoseScore = reverseScoreMap[activeScore.team1Score];
      }
    }

    console.log('teamWinScore:', teamWinScore);
    console.log('teamLoseScore:', teamLoseScore);

    // I. Update score
    let scoreData = {};
    if (!activeGame.isTieBreak) {
      // I.1. Update normal game score
      // Normal game score definition
      // 0: 0
      // 1: 15
      // 2: 30
      // 3: 40
      // 4: A (Advantage)
      // 5: Game (Win)

      // Update score by rules
      if (teamWinScore >= 4 && teamWinScore >= teamLoseScore + 2) {
        // Win based on a two-point lead
        teamWinScore = 5; // Win
        isGameEnd = true;

        // TODO: Noti: Game end
      } else if (teamWinScore === 4 && teamLoseScore === 4) {
        // Deuce
        teamWinScore = 3; // 40
        teamLoseScore = 3; // 40
      } else {
        // Normal score
        // Do nothing
      }

      // Build score data
      if (dto.teamWin === 1) {
        scoreData = {
          teamWinId: assignedMatch.teamId1,
          team1Score: scoreMap[teamWinScore],
          team2Score: scoreMap[teamLoseScore],
        };
      } else {
        scoreData = {
          teamWinId: assignedMatch.teamId2,
          team1Score: scoreMap[teamLoseScore],
          team2Score: scoreMap[teamWinScore],
        };
      }

      // console.log('scoreData:', scoreData);
    } else {
      // I.2. Update tie break game score
      // Tie break game score definition
      // 0: 0
      // 1: 1
      // 2: 2
      // ...

      // if (teamWinScore >= 7 && teamWinScore >= teamLoseScore + 2) {
      //   // Win based on a two-point lead
      //   isGameEnd = true;
      // } else {
      //   // Normal score
      //   // Do nothing
      // }

      // Update score by rules (First to 7 points -> win)
      if (teamWinScore >= 7) {
        // Win
        isGameEnd = true;
      } else {
        // Normal score
        // Do nothing
      }

      // Build score data
      if (dto.teamWin === 1) {
        scoreData = {
          teamWinId: assignedMatch.teamId1,
          team1Score: `${teamWinScore}`,
          team2Score: `${teamLoseScore}`,
        };
      } else {
        scoreData = {
          teamWinId: assignedMatch.teamId2,
          team1Score: `${teamLoseScore}`,
          team2Score: `${teamWinScore}`,
        };
      }

      // console.log('scoreData:', scoreData);
    }

    try {
      // Add score record
      await this.prismaService.scores.create({
        data: {
          gameId: activeGame.id,
          type: dto.type,
          time: scoreTime,
          teamServeId: dto.teamServeId,
          ...scoreData,
        },
      });

      console.log('isGameEnd:', isGameEnd);
      if (isGameEnd) {
        // Update current game:
        // - teamWinId
        await this.prismaService.games.update({
          where: {
            id: activeGame.id,
          },
          data: {
            teamWinId: scoreData['teamWinId'],
          },
        });

        // II. Update set
        let isSetEnd = false;
        let initedTieBreakGame = false;

        // Calculate set score (amount of win games)
        let teamWinSetScore = 0;
        let teamLoseSetScore = 0;
        if (dto.teamWin === 1) {
          teamWinSetScore = activeSet.team1SetScore + 1;
          teamLoseSetScore = activeSet.team2SetScore;
        } else {
          teamWinSetScore = activeSet.team2SetScore + 1;
          teamLoseSetScore = activeSet.team1SetScore;
        }

        console.log('teamWinSetScore:', teamWinSetScore);
        console.log('teamLoseSetScore:', teamLoseSetScore);
        console.log(
          'teamWinSetScore >= 6 && teamWinSetScore === teamLoseSetScore',
          teamWinSetScore >= 6 && teamWinSetScore === teamLoseSetScore,
        );

        // Check set score (amount of win games) by rules
        let updateSetData = {};
        if (teamWinSetScore >= 6 && teamWinSetScore >= teamLoseSetScore + 2) {
          // Win based on a two-game lead
          isSetEnd = true;
          if (dto.teamWin === 1) {
            updateSetData = {
              teamWinId: scoreData['teamWinId'],
              status: SetStatus.ended,
              team1SetScore: teamWinSetScore,
              team2SetScore: teamLoseSetScore,
            };
          } else {
            updateSetData = {
              teamWinId: scoreData['teamWinId'],
              status: SetStatus.ended,
              team1SetScore: teamLoseSetScore,
              team2SetScore: teamWinSetScore,
            };
          }

          // TODO: Noti: Set end
        } else if (teamWinSetScore == 7) {
          // Tie break win -> Set end
          isSetEnd = true;
          if (dto.teamWin === 1) {
            updateSetData = {
              teamWinId: scoreData['teamWinId'],
              status: SetStatus.ended,
              team1SetScore: teamWinSetScore,
              team2SetScore: teamLoseSetScore,
            };
          } else {
            updateSetData = {
              teamWinId: scoreData['teamWinId'],
              status: SetStatus.ended,
              team1SetScore: teamLoseSetScore,
              team2SetScore: teamWinSetScore,
            };
          }
        } else if (
          teamWinSetScore >= 6 &&
          teamWinSetScore === teamLoseSetScore
        ) {
          console.log('tie break');
          initedTieBreakGame = true;

          // Tie break
          updateSetData = {
            team1SetScore: teamWinSetScore,
            team2SetScore: teamLoseSetScore,
            isTieBreak: true,
          };

          // Tie break logic
          // Update set (isTieBreak = true)
          await this.prismaService.sets.update({
            where: {
              id: activeSet.id,
            },
            data: {
              isTieBreak: true,
            },
          });

          // Create new tie break game
          const newTieBreak = await this.prismaService.games.create({
            data: {
              setId: activeSet.id,
              isTieBreak: true,
            },
          });

          // Create init tie break score (0 - 0)
          await this.prismaService.scores.create({
            data: {
              gameId: newTieBreak.id,
              teamServeId: dto.teamServeId,
            },
          });
        } else {
          // Normal set score
          if (dto.teamWin === 1) {
            updateSetData = {
              team1SetScore: teamWinSetScore,
              team2SetScore: teamLoseSetScore,
            };
          } else {
            updateSetData = {
              team1SetScore: teamLoseSetScore,
              team2SetScore: teamWinSetScore,
            };
          }
        }

        // Update set
        await this.prismaService.sets.update({
          where: {
            id: activeSet.id,
          },
          data: updateSetData,
        });

        console.log('isSetEnd:', isSetEnd);
        if (isSetEnd) {
          // Update current set:
          // - teamWinId
          // - status
          await this.prismaService.sets.update({
            where: {
              id: activeSet.id,
            },
            data: {
              teamWinId: updateSetData['teamWinId'],
              status: SetStatus.ended,
            },
          });

          // III. Update match
          let isMatchEnd = false;

          // Calculate match score (amount of win sets)
          let teamWinMatchScore = 0;
          let teamLoseMatchScore = 0;
          if (dto.teamWin === 1) {
            teamWinMatchScore = assignedMatch.team1MatchScore + 1;
            teamLoseMatchScore = assignedMatch.team2MatchScore;
          } else {
            teamWinMatchScore = assignedMatch.team2MatchScore + 1;
            teamLoseMatchScore = assignedMatch.team1MatchScore;
          }

          // Check match score (amount of win sets) by rules
          let updateMatchData = {};
          let updateNextMatchData = {};
          let [winnerElo, loserElo] = [0, 0];
          if (teamWinMatchScore >= 2) {
            console.log('win match, 2 sets lead');
            // Win based on a two-set lead
            isMatchEnd = true;
            if (dto.teamWin === 1) {
              updateMatchData = {
                teamWinnerId: scoreData['teamWinId'],
                status: MatchStatus.score_done,
                matchEndDate: new Date(),
                team1MatchScore: teamWinMatchScore,
                team2MatchScore: teamLoseMatchScore,
              };
            } else {
              updateMatchData = {
                teamWinnerId: scoreData['teamWinId'],
                status: MatchStatus.score_done,
                matchEndDate: new Date(),
                team1MatchScore: teamLoseMatchScore,
                team2MatchScore: teamWinMatchScore,
              };
            }

            if (assignedMatch.nextMatchId) {
              const nextMatch = await this.prismaService.matches.findUnique({
                where: {
                  id: assignedMatch.nextMatchId,
                },
              });
              let matchStatus = undefined;
              const matchNumber = parseInt(assignedMatch.title.match(/\d+/)[0]);
              if (
                nextMatch.status === MatchStatus.no_show &&
                (nextMatch.teamId1 || nextMatch.teamId2)
              ) {
                matchStatus = MatchStatus.scheduled;
              }
              if (matchNumber % 2 !== 0) {
                updateNextMatchData = {
                  teamId1: scoreData['teamWinId'],
                  status: matchStatus,
                };
              } else {
                updateNextMatchData = {
                  teamId2: scoreData['teamWinId'],
                  status: matchStatus,
                };
              }
              await this.prismaService.matches.update({
                where: {
                  id: assignedMatch.nextMatchId,
                },
                data: updateNextMatchData,
              });
            } else {
              await this.prismaService.teams.update({
                where: {
                  id: scoreData['teamWinId'],
                },
                data: {
                  point: {
                    increment: 1,
                  },
                },
              });
            }

            // update elo
            if (assignedMatch.team1.tournamentId) {
              const tournament =
                await this.prismaService.tournaments.findUnique({
                  where: {
                    id: assignedMatch.team1.tournamentId,
                  },
                  select: {
                    level: true,
                  },
                });
              if (dto.teamWin === 1) {
                [winnerElo, loserElo] = this.calculateTennisElo(
                  assignedMatch.team1.totalElo,
                  assignedMatch.team2.totalElo,
                  tournament.level,
                );
                console.log(winnerElo, loserElo);
                const user1WinnerElo = assignedMatch.team1.user1.elo || 200;
                let sumElo = this.sumElo(user1WinnerElo, winnerElo);

                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team1.userId1,
                  },
                  data: {
                    elo: sumElo,
                  },
                });
                if (assignedMatch.team1.userId2) {
                  const user2WinnerElo = assignedMatch.team1.user2.elo || 200;
                  sumElo = this.sumElo(user2WinnerElo, winnerElo);
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team1.userId2,
                    },
                    data: {
                      elo: sumElo,
                    },
                  });
                }

                const user1LoserElo = assignedMatch.team2.user1.elo || 200;
                sumElo = this.sumElo(user1LoserElo, loserElo);

                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team2.userId1,
                  },
                  data: {
                    elo: sumElo,
                  },
                });
                if (assignedMatch.team2.userId2) {
                  const user2LoserElo = assignedMatch.team2.user2.elo || 200;
                  sumElo = this.sumElo(user2LoserElo, loserElo);
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team2.userId2,
                    },
                    data: {
                      elo: sumElo,
                    },
                  });
                }
              } else {
                [winnerElo, loserElo] = this.calculateTennisElo(
                  assignedMatch.team2.totalElo,
                  assignedMatch.team1.totalElo,
                  tournament.level,
                );
                console.log(winnerElo, loserElo);
                const user1WinnerElo = assignedMatch.team2.user1.elo || 200;
                let sumElo = this.sumElo(user1WinnerElo, winnerElo);
                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team2.userId1,
                  },
                  data: {
                    elo: sumElo,
                  },
                });
                if (assignedMatch.team2.userId2) {
                  const user2WinnerElo = assignedMatch.team2.user2.elo || 200;
                  sumElo = this.sumElo(user2WinnerElo, winnerElo);
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team2.userId2,
                    },
                    data: {
                      elo: sumElo,
                    },
                  });
                }
                const user1LoserElo = assignedMatch.team1.user1.elo || 200;
                sumElo = this.sumElo(user1LoserElo, loserElo);
                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team1.userId1,
                  },
                  data: {
                    elo: sumElo,
                  },
                });
                if (assignedMatch.team1.userId2) {
                  const user2LoserElo = assignedMatch.team1.user2.elo || 200;
                  sumElo = this.sumElo(user2LoserElo, loserElo);
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team1.userId2,
                    },
                    data: {
                      elo: sumElo,
                    },
                  });
                }
              }
            }

            const userIds = [];
            let otherParams, type;
            if (assignedMatch.team1.tournamentId) {
              const participants = await this.prismaService.teams.findMany({
                where: {
                  tournamentId: assignedMatch.team1.tournamentId,
                },
              });

              participants.forEach((participant) => {
                if (participant.userId1) {
                  userIds.push(participant.userId1);
                }
                if (participant.userId2) {
                  userIds.push(participant.userId2);
                }
              });
              otherParams = {
                tournamentId: assignedMatch.team1.tournamentId,
              };
              if (assignedMatch.teamId1 && assignedMatch.teamId2) {
                type = 'tournament_matches_on_going';
              } else {
                type = 'tournament_matches_schedule';
              }
            } else {
              const participants = await this.prismaService.teams.findMany({
                where: {
                  groupTournamentId: assignedMatch.team1.groupTournamentId,
                },
              });

              participants.forEach((participant) => {
                if (participant.userId1) {
                  userIds.push(participant.userId1);
                }
                if (participant.userId2) {
                  userIds.push(participant.userId2);
                }
              });
              otherParams = {
                groupTournamentId: assignedMatch.team1.groupTournamentId,
              };
              if (assignedMatch.teamId1 && assignedMatch.teamId2) {
                type = 'group_tournament_matches_on_going';
              } else {
                type = 'group_tournament_matches_schedule';
              }
            }

            // Send notification
            const followUsers = (
              await this.prismaService.users_follow_matches.findMany({
                where: {
                  matchId: matchId,
                },
                select: {
                  userId: true,
                },
              })
            ).map((user) => {
              return user.userId;
            });
            const notification = {
              title: 'Match End',
              body: "The match you're following has been ended! Check the latest score now",
            };
            const notiData = {
              mobileType: 'MATCH_UPDATE',
              type,
              params: {
                matchId: matchId,
                ...otherParams,
              },
              notification,
              web: true,
              mobile: true,
            };
            const notificationData = {
              userIds: [...new Set(followUsers.concat(userIds))],
              notiData,
            };
            await this.notificationProducer.add(notificationData);
          } else {
            // Normal match score
            if (dto.teamWin === 1) {
              updateMatchData = {
                team1MatchScore: teamWinMatchScore,
                team2MatchScore: teamLoseMatchScore,
              };
            } else {
              updateMatchData = {
                team1MatchScore: teamLoseMatchScore,
                team2MatchScore: teamWinMatchScore,
              };
            }
          }

          // Update match
          await this.prismaService.matches.update({
            where: {
              id: matchId,
            },
            data: updateMatchData,
          });

          console.log('isMatchEnd:', isMatchEnd);
          console.log('matchId:', matchId);
          if (!isMatchEnd) {
            console.log('match not end, create new set');
            // Create new set
            await this.prismaService.sets.create({
              data: {
                matchId: matchId,
                // status: SetStatus.not_started, // default status
              },
            });
          }

          const userIds = [];
          let otherParams, type;
          if (assignedMatch.team1.tournamentId) {
            const participants = await this.prismaService.teams.findMany({
              where: {
                tournamentId: assignedMatch.team1.tournamentId,
              },
            });

            participants.forEach((participant) => {
              if (participant.userId1) {
                userIds.push(participant.userId1);
              }
              if (participant.userId2) {
                userIds.push(participant.userId2);
              }
            });
            otherParams = {
              tournamentId: assignedMatch.team1.tournamentId,
            };
            if (assignedMatch.teamId1 && assignedMatch.teamId2) {
              type = 'tournament_matches_on_going';
            } else {
              type = 'tournament_matches_schedule';
            }
          } else {
            const participants = await this.prismaService.teams.findMany({
              where: {
                groupTournamentId: assignedMatch.team1.groupTournamentId,
              },
            });

            participants.forEach((participant) => {
              if (participant.userId1) {
                userIds.push(participant.userId1);
              }
              if (participant.userId2) {
                userIds.push(participant.userId2);
              }
            });
            otherParams = {
              groupTournamentId: assignedMatch.team1.groupTournamentId,
            };
            if (assignedMatch.teamId1 && assignedMatch.teamId2) {
              type = 'group_tournament_matches_on_going';
            } else {
              type = 'group_tournament_matches_schedule';
            }
          }
          // Send notification
          const followUsers = (
            await this.prismaService.users_follow_matches.findMany({
              where: {
                matchId: matchId,
              },
              select: {
                userId: true,
              },
            })
          ).map((user) => {
            return user.userId;
          });
          const notification = {
            title: 'Match Score Update',
            body: "The match you're following has an update! Check the latest score now",
          };
          const notiData = {
            mobileType: 'MATCH_UPDATE',
            type,
            params: {
              matchId: matchId,
              ...otherParams,
            },
            notification,
            web: false,
            mobile: true,
          };
          const notificationData = {
            userIds: [...new Set(followUsers.concat(userIds))],
            notiData,
          };
          await this.notificationProducer.add(notificationData);
        } else {
          if (!initedTieBreakGame) {
            console.log('create new game, set not end');
            // Set not end -> New game
            // Create new game
            const newGame = await this.prismaService.games.create({
              data: {
                setId: activeSet.id,
              },
            });

            // Creat init score (0 - 0)
            await this.prismaService.scores.create({
              data: {
                gameId: newGame.id,
                teamServeId: dto.teamServeId,
              },
            });
          }
        }
      }

      return await this.getMatchDetails(matchId, refereeId);
    } catch (err) {
      console.log('err', err);
      throw new InternalServerErrorException({
        message: `Error: ${err.message}`,
      });
    }
  }

  async updateMatch(matchId: string, userId: string, dto: UpdateMatchDto) {
    const match = await this.prismaService.matches.findFirst({
      where: {
        id: matchId,
      },
      include: {
        round: {
          include: {
            fixture: {
              include: {
                fixture: {
                  include: {
                    tournament: true,
                    groupTournament: {
                      include: {
                        group: true,
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
    let purchasedPackage;
    if (match.round.fixture.fixture.tournament?.purchasedPackageId) {
      // Get purchased package info
      purchasedPackage =
        await this.mongodbPrismaService.purchasedPackage.findUnique({
          where: {
            id: match.round.fixture.fixture.tournament.purchasedPackageId,
          },
        });
    } else if (
      match.round.fixture.fixture.groupTournament?.group.purchasedPackageId
    ) {
      purchasedPackage =
        await this.mongodbPrismaService.purchasedPackage.findUnique({
          where: {
            id: match.round.fixture.fixture.groupTournament.group
              .purchasedPackageId,
          },
        });
    }

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
        message: 'You are not a creator of this tournament',
        data: null,
      });
    }

    const updatedMatch = await this.prismaService.matches.update({
      where: {
        id: match.id,
      },
      data: {
        groupFixtureTeamId1: dto.groupFixtureTeamId1,
        groupFixtureTeamId2: dto.groupFixtureTeamId2,
        rankGroupTeam1: dto.rankGroupTeam1,
        rankGroupTeam2: dto.rankGroupTeam2,
        teamId1: dto.teamId1,
        teamId2: dto.teamId2,
        teamWinnerId: dto.teamWinnerId,
        matchStartDate: dto.matchStartDate,
        matchEndDate: dto.matchEndDate,
        venue: dto.venue,
        duration: dto.duration,
        breakDuration: dto.breakDuration,
        nextMatchId: dto.nextMatchId,
        title: dto.title,
        refereeId: dto.refereeId,
        team1MatchScore: dto.team1MatchScore,
        team2MatchScore: dto.team2MatchScore,
        status: dto.status,
      },
    });
    if (
      match.round.fixture.fixture?.tournament?.phase === 'generated_fixtures' ||
      match.round.fixture.fixture?.groupTournament?.phase ===
        'generated_fixtures'
    ) {
      const userIds = [];
      let otherParams, type;
      if (match.round.fixture.fixture.tournamentId) {
        const participants = await this.prismaService.teams.findMany({
          where: {
            tournamentId: match.round.fixture.fixture.tournamentId,
          },
        });

        participants.forEach((participant) => {
          if (participant.userId1) {
            userIds.push(participant.userId1);
          }
          if (participant.userId2) {
            userIds.push(participant.userId2);
          }
        });
        otherParams = {
          tournamentId: match.round.fixture.fixture.tournamentId,
        };
        if (match.teamId1 && match.teamId2) {
          type = 'tournament_matches_on_going';
        } else {
          type = 'tournament_matches_schedule';
        }
      } else {
        const participants = await this.prismaService.teams.findMany({
          where: {
            groupTournamentId: match.round.fixture.fixture.groupTournamentId,
          },
        });

        participants.forEach((participant) => {
          if (participant.userId1) {
            userIds.push(participant.userId1);
          }
          if (participant.userId2) {
            userIds.push(participant.userId2);
          }
        });
        otherParams = {
          groupTournamentId: match.round.fixture.fixture.groupTournamentId,
        };
        if (match.teamId1 && match.teamId2) {
          type = 'group_tournament_matches_on_going';
        } else {
          type = 'group_tournament_matches_schedule';
        }
      }

      const followUsers = (
        await this.prismaService.users_follow_matches.findMany({
          where: {
            matchId: matchId,
          },
          select: {
            userId: true,
          },
        })
      ).map((user) => {
        return user.userId;
      });
      const notification = {
        title: 'Match Update',
        body: `The match you are following has just been updated! It is scheduled for ${match.matchStartDate.toDateString()}.`,
      };
      const notiData = {
        mobileType: 'MATCH_UPDATE',
        type,
        params: {
          matchId: matchId,
          ...otherParams,
        },
        notification,
        web: true,
        mobile: true,
      };
      userIds.push(match.refereeId);
      const notificationData = {
        userIds: [...new Set(followUsers.concat(userIds))],
        notiData,
      };
      await this.notificationProducer.add(notificationData);
    }

    return updatedMatch;
  }

  // Utils
  calculateTimeDifference(dateA: Date, dateB: Date): string {
    // Get the time values from the Date objects
    const timestampA = dateA.getTime();
    const timestampB = dateB.getTime();

    // Calculate the difference in milliseconds
    const diffMs = Math.abs(timestampB - timestampA);

    // Convert the difference to hours, minutes, and seconds
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

    // Format the result as HH:mm:ss
    const result = `${String(diffHrs).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}:${String(diffSecs).padStart(2, '0')}`;

    return result;
  }

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

  calculateEloNew(
    eloA: number,
    eloB: number,
    D: number,
    m: number,
    n: number,
  ): [number, number] {
    if (eloA === 0) {
      eloA = 200;
    }

    if (eloB === 0) {
      eloB = 200;
    }

    const eloAvg = (eloA + eloB) / 2;
    const eloDiff = Math.abs(eloA - eloB);
    const expTerm = Math.exp(-eloDiff / eloAvg);
    const k = eloAvg / 60;

    const eloA_new =
      (k *
        (1 + D / 10 - expTerm) *
        (1 + D / 10 + (eloAvg - eloA) / eloAvg) *
        (m + n)) /
      n;
    const eloB_new =
      (k *
        expTerm *
        (1 + D / 10 - (eloAvg - eloB) / eloAvg) *
        (2 * m - n + 1)) /
      n;

    return [eloA_new, eloB_new];
  }

  calculateTennisElo(
    winnerElo: number,
    loserElo: number,
    tournamentLevel: number,
  ) {
    if (!winnerElo) {
      winnerElo = 200;
    }

    if (!loserElo) {
      loserElo = 200;
    }
    // Hằng số K cơ bản
    const K_base: number = 32;

    // Tính hằng số K dựa trên mức độ giải đấu (từ 0 đến 9)
    let K: number;
    switch (tournamentLevel) {
      case 0:
        K = K_base + 10;
        break;
      case 1:
        K = K_base + 8;
        break;
      case 2:
        K = K_base + 6;
        break;
      case 3:
        K = K_base + 4;
        break;
      case 4:
        K = K_base + 2;
        break;
      case 5:
        K = K_base;
        break;
      case 6:
        K = K_base - 2;
        break;
      case 7:
        K = K_base - 4;
        break;
      case 8:
        K = K_base - 6;
        break;
      case 9:
        K = K_base - 8;
        break;
      default:
        K = K_base;
    }

    // Tính điểm chênh lệch
    const diff: number = Math.abs(winnerElo - loserElo);

    // Điều chỉnh K dựa trên chênh lệch điểm
    if (diff >= 1000) {
      K += 100; // Chênh lệch lớn hơn hoặc bằng 400 điểm, tăng K thêm 10
    } else if (diff >= 300) {
      K += 8; // Chênh lệch lớn hơn hoặc bằng 300 điểm, tăng K thêm 8
    } else if (diff >= 200) {
      K += 6; // Chênh lệch lớn hơn hoặc bằng 200 điểm, tăng K thêm 6
    } else if (diff >= 100) {
      K += 4; // Chênh lệch lớn hơn hoặc bằng 100 điểm, tăng K thêm 4
    }

    // Tính kết quả dự đoán
    const E_winner: number =
      1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const E_loser: number =
      1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

    // Kết quả thực tế (đơn giản 1 cho người thắng, 0 cho người thua)
    const S_winner: number = 1;
    const S_loser: number = 0;

    // Tính toán Elo mới sau trận đấu
    const winnerEloPrime: number = Math.ceil(K * (S_winner - E_winner));
    const loserEloPrime: number = Math.ceil(K * (S_loser - E_loser));

    return [winnerEloPrime, loserEloPrime];
  }

  sumElo(elo: number, change: number) {
    const finalElo = elo + change;
    if (finalElo < 200) {
      return 200;
    }
    return finalElo;
  }
}
