import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RefereesTournamentsService } from './referees_tournaments.service';
import { CreateRefereesTournamentDto } from './dto/create-referees_tournament.dto';
import { UpdateRefereesTournamentDto } from './dto/update-referees_tournament.dto';

@Controller('referees-tournaments')
export class RefereesTournamentsController {
  constructor(private readonly refereesTournamentsService: RefereesTournamentsService) {}

  @Post()
  create(@Body() createRefereesTournamentDto: CreateRefereesTournamentDto) {
    return this.refereesTournamentsService.create(createRefereesTournamentDto);
  }

  @Get()
  findAll() {
    return this.refereesTournamentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.refereesTournamentsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRefereesTournamentDto: UpdateRefereesTournamentDto) {
    return this.refereesTournamentsService.update(+id, updateRefereesTournamentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.refereesTournamentsService.remove(+id);
  }
}
