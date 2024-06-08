import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRefereesTournamentDto } from './dto/create-referees_tournament.dto';
import { UpdateRefereesTournamentDto } from './dto/update-referees_tournament.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CustomResponseStatusCodes } from 'src/helper/custom-response-status-code';
import { CustomResponseMessages } from 'src/helper/custom-response-message';
import { PageOptionsRefereesTournamentsDto } from './dto/page-options-referees-tournaments.dto';

@Injectable()
export class RefereesTournamentsService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(createRefereesTournamentDto: CreateRefereesTournamentDto) {}

  findAll() {
    return `This action returns all refereesTournaments`;
  }

  findOne(id: number) {
    return `This action returns a #${id} refereesTournament`;
  }

  update(id: number, updateRefereesTournamentDto: UpdateRefereesTournamentDto) {
    return `This action updates a #${id} refereesTournament`;
  }

  remove(id: number) {
    return `This action removes a #${id} refereesTournament`;
  }

  async findByTournament(
    pageOptionsRefereesTournamentsDto: PageOptionsRefereesTournamentsDto,
    tournamentId: number,
  ) {
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsRefereesTournamentsDto.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
      },
    };

    const pageOption =
      pageOptionsRefereesTournamentsDto.page &&
      pageOptionsRefereesTournamentsDto.take
        ? {
            skip: pageOptionsRefereesTournamentsDto.skip,
            take: pageOptionsRefereesTournamentsDto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.referees_tournaments.findMany({
        ...conditions,
        ...pageOption,
        include: {
          referee: {
            select: {
              id: true,
              image: true,
              name: true,
              gender: true,
              dob: true,
              phoneNumber: true,
              elo: true,
              email: true,
            },
          },
        },
      }),
      this.prismaService.referees_tournaments.count({ ...conditions }),
    ]);
    const mapData = result.map((result) => {
      return result.referee;
    });

    return {
      data: mapData,
      totalPages: Math.ceil(
        totalCount / pageOptionsRefereesTournamentsDto.take,
      ),
      totalCount,
    };
  }
}
