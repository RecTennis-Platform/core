import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GetUser, Roles } from 'src/auth_utils/decorators';
import { JwtGuard, RolesGuard } from 'src/auth_utils/guards';
import { IRequestWithUser } from 'src/auth_utils/interfaces';
import {
  CreateAdminAccountDto,
  PageOptionsRefereeMatchesDto,
  PageOptionsUserFollowedMatchesDto,
  PageOptionsUserParticipatedTournamentsDto,
  PageOptionsUsersListDto,
  UpdateUserAccountDto,
} from './dto';
import { UserService } from './user.service';
import { PageOptionsNotificationDto, UpdateNotitDto } from './dto/noti.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('admin/all')
  async adminGetAllUsers(@Query() pageOptions: PageOptionsUsersListDto) {
    return await this.userService.getAllUsers(pageOptions);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('admin/:id')
  async adminGetUserDetails(@Param('id') id: string) {
    return await this.userService.getUserDetails(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Post('admin')
  async createAdminAccount(@Body() dto: CreateAdminAccountDto) {
    return await this.userService.createAdminAccount(dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Patch('admin/:id')
  async adminUpdateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserAccountDto,
  ) {
    console.log('Admin update user');
    return await this.userService.updateUserDetails(id, dto);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  async getUserDetails(@Req() req: IRequestWithUser) {
    const userId = req.user['sub'];
    return await this.userService.getUserDetails(userId);
  }

  @UseGuards(JwtGuard)
  @Get('system-noti')
  async getUserNoti(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsNotificationDto,
  ) {
    return await this.userService.getUserNotifications(userId, pageOptions);
  }

  @UseGuards(JwtGuard)
  @Patch('system-noti')
  async updateNoti(
    @GetUser('sub') userId: string,
    @Body() dto: UpdateNotitDto,
  ) {
    return await this.userService.markNotificationAsRead(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  async updateUser(
    @Req() req: IRequestWithUser,
    @Body() dto: UpdateUserAccountDto,
  ) {
    console.log('User update user');
    const userId = req.user['sub'];
    return await this.userService.updateUserDetails(userId, dto);
  }

  // Get my participated tournaments
  @UseGuards(JwtGuard)
  @Get('tournaments')
  async getMyParticipatedTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsUserParticipatedTournamentsDto,
  ) {
    return await this.userService.getMyParticipatedTournaments(
      userId,
      pageOptions,
    );
  }

  // Get my participated tournaments
  @UseGuards(JwtGuard)
  @Get('groups/:groupId/tournaments')
  async getMyParticipatedGroupTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsUserParticipatedTournamentsDto,
    @Param('groupId') groupId: number,
  ) {
    return await this.userService.getMyParticipatedGroupTournaments(
      userId,
      pageOptions,
      groupId,
    );
  }

  @UseGuards(JwtGuard)
  @Post('matches/:matchId/follow')
  async followMatch(
    @GetUser('sub') userId: string,
    @Param('matchId') matchId: string,
  ) {
    return await this.userService.followMatch(userId, matchId);
  }

  @UseGuards(JwtGuard)
  @Delete('matches/:matchId/unfollow')
  async unFollowMatch(
    @GetUser('sub') userId: string,
    @Param('matchId') matchId: string,
  ) {
    return await this.userService.unFollowMatch(userId, matchId);
  }

  // Get other user's participated tournaments (status = completed)
  @Get(':userId/tournaments-history')
  async getUserTournamentsHistory(
    @Param('userId') userId: string,
    @Query() pageOptions: PageOptionsUserParticipatedTournamentsDto,
  ) {
    return await this.userService.getUserParticipatedTournaments(
      userId,
      pageOptions,
    );
  }

  // Referee
  @UseGuards(JwtGuard)
  @Get('referee/match')
  async getRefereeMatches(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsRefereeMatchesDto,
  ) {
    return await this.userService.getRefereeMatches(userId, pageOptions);
  }

  @UseGuards(JwtGuard)
  @Get('matches/follow')
  async getUserFollowedMatches(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsUserFollowedMatchesDto,
  ) {
    return await this.userService.getUserFollowedMatches(userId, pageOptions);
  }

  @Get(':userId/test-noti')
  async testNoti(@Param('userId') userId: string) {
    return await this.userService.testNotification(userId);
  }

  @Get(':userId')
  async getUserDetailsById(@Param('userId') userId: string) {
    return await this.userService.getUserDetails(userId);
  }
}
