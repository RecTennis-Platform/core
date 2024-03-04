import { Controller, Get, Patch, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getUserInfo() {}

  @Get('all')
  async getAllUsers() {}

  @Get(':id')
  async getUserDetails() {}

  @Post('admin/create')
  async createAdminAccount() {}

  @Patch(':id')
  async updateUser() {}
}
