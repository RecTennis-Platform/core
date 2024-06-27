import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { MatchStatus, ScoreType, SetStatus } from '@prisma/client';
import { Order } from 'constants/order';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateScoreDto } from './dto';
import { reverseScoreMap, scoreMap } from './constanst';
import { NotificationProducer } from 'src/services/notification/notification-producer';

@Injectable()
export class MatchService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationProducer: NotificationProducer,
  ) {}

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
            id: true,
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
            id: true,
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

    // Remove unnecessary data
    delete matchDetails.teamId1;
    delete matchDetails.teamId2;

    matchDetails['matchFinalScore'] = matchFinalScore;

    return matchDetails;
  }

  async startMatch(matchId: string, refereeId: string) {
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

    // Check match status
    if (assignedMatch.status !== MatchStatus.scheduled) {
      throw new BadRequestException(
        `Match status is '${assignedMatch.status}'`,
      );
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
        },
      });

      // Update match status (scheduled -> walk_over)
      await this.prismaService.matches.update({
        where: {
          id: matchId,
        },
        data: {
          status: MatchStatus.walk_over,
          matchStartDate: new Date(),
        },
      });

      return await this.getMatchDetails(matchId);
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

      return await this.getMatchDetails(matchId);
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
        team1: true,
        team2: true,
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

    let isGameEnd = false;

    // Get current score
    let teamWinScore = 0;
    let teamLoseScore = 0;
    if (dto.teamWin === 1) {
      teamWinScore = reverseScoreMap[activeScore.team1Score] + 1;
      teamLoseScore = reverseScoreMap[activeScore.team2Score];
    } else {
      teamWinScore = reverseScoreMap[activeScore.team2Score] + 1;
      teamLoseScore = reverseScoreMap[activeScore.team1Score];
    }

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

      // Update score by rules
      if (teamWinScore >= 7 && teamWinScore >= teamLoseScore + 2) {
        // Win based on a two-point lead
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
          time: dto.time,
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
        } else if (
          teamWinSetScore >= 6 &&
          teamWinSetScore === teamLoseSetScore
        ) {
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
          await this.prismaService.games.create({
            data: {
              setId: activeSet.id,
              isTieBreak: true,
            },
          });

          // Create init tie break score (0 - 0)
          await this.prismaService.scores.create({
            data: {
              gameId: activeGame.id,
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
              if (nextMatch.teamId1 === null) {
                updateNextMatchData = {
                  teamId1: scoreData['teamWinId'],
                };
              } else {
                updateNextMatchData = {
                  teamId2: scoreData['teamWinId'],
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
                [winnerElo, loserElo] = this.calculateEloNew(
                  assignedMatch.team1.totalElo,
                  assignedMatch.team2.totalElo,
                  tournament.level,
                  10,
                  5,
                );

                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team1.userId1,
                  },
                  data: {
                    elo: {
                      increment: winnerElo,
                    },
                  },
                });
                if (assignedMatch.team1.userId2) {
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team1.userId2,
                    },
                    data: {
                      elo: {
                        increment: winnerElo,
                      },
                    },
                  });
                }

                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team2.userId1,
                  },
                  data: {
                    elo: {
                      increment: loserElo,
                    },
                  },
                });
                if (assignedMatch.team2.userId2) {
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team2.userId2,
                    },
                    data: {
                      elo: {
                        increment: loserElo,
                      },
                    },
                  });
                }
              } else {
                [winnerElo, loserElo] = this.calculateEloNew(
                  assignedMatch.team2.totalElo,
                  assignedMatch.team1.totalElo,
                  tournament.level,
                  10,
                  5,
                );
                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team2.userId1,
                  },
                  data: {
                    elo: {
                      increment: winnerElo,
                    },
                  },
                });
                if (assignedMatch.team2.userId2) {
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team2.userId2,
                    },
                    data: {
                      elo: {
                        increment: winnerElo,
                      },
                    },
                  });
                }

                await this.prismaService.users.update({
                  where: {
                    id: assignedMatch.team1.userId1,
                  },
                  data: {
                    elo: {
                      increment: loserElo,
                    },
                  },
                });
                if (assignedMatch.team1.userId2) {
                  await this.prismaService.users.update({
                    where: {
                      id: assignedMatch.team1.userId2,
                    },
                    data: {
                      elo: {
                        increment: loserElo,
                      },
                    },
                  });
                }
              }
            }

            // TODO: Noti: Match end
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
          const notificationData = {
            userIds: followUsers,
            matchId: matchId,
          };
          await this.notificationProducer.add(notificationData);
        } else {
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
            },
          });
        }
      }

      return await this.getMatchDetails(matchId);
    } catch (err) {
      console.log('err', err);
      throw new InternalServerErrorException({
        message: `Error: ${err.message}`,
      });
    }
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
}
