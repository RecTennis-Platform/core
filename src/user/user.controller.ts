import { UserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth_utils/decorators';
import { JwtGuard, RolesGuard } from 'src/auth_utils/guards';
import { IRequestWithUser } from 'src/auth_utils/interfaces';
import { CreateAdminAccountDto, UpdateUserAccountDto } from './dto';
import { UserService } from './user.service';

@UseGuards(JwtGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @Get('admin/all')
  async adminGetAllUsers() {
    return await this.userService.getAllUsers();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @Get('admin/:id')
  async adminGetUserDetails(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getUserDetails(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @Post('admin')
  async createAdminAccount(@Body() dto: CreateAdminAccountDto) {
    return await this.userService.createAdminAccount(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @Patch('admin/:id')
  async adminUpdateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserAccountDto,
  ) {
    console.log('Admin update user');
    return await this.userService.updateUserDetails(id, dto);
  }

  @Get('me')
  async getUserDetails(@Req() req: IRequestWithUser) {
    const userId = req.user['sub'];
    return await this.userService.getUserDetails(userId);
  }

  @Patch(':id')
  async updateUser(
    @Req() req: IRequestWithUser,
    @Body() dto: UpdateUserAccountDto,
  ) {
    console.log('User update user');
    const userId = req.user['sub'];
    return await this.userService.updateUserDetails(userId, dto);
  }
}
