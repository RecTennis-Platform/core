import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GroupStatus } from '@prisma/client';
import { CorePrismaService } from 'src/prisma/prisma_core.service';
import { CreateGroupDto, UpdateGroupDto } from './dto';
import { PageOptionsGroupDto } from './dto/page-options-group.dto';
import { MailService } from 'src/services/mail/mail.service';
import { InviteUser2GroupDto } from './dto/invite-user.dto';
import { AuthPrismaService } from 'src/prisma/prisma_auth.service';
import { ITokenPayload } from 'src/auth_utils/interfaces';
import { JwtService } from '@nestjs/jwt';
import { SendMailTemplateDto } from 'src/services/mail/mail.dto';

@Injectable()
export class GroupService {
  constructor(
    private corePrismaService: CorePrismaService,
    private readonly mailService: MailService,
    private readonly authPrismaService: AuthPrismaService,
    private jwtService: JwtService,
  ) {}

  async create(adminId: number, dto: CreateGroupDto) {
    const purchasedPackage = await this.corePrismaService.packages.findUnique({
      where: {
        id: dto.packageId,
      },
    });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Package not found',
        data: null,
      });
    }

    try {
      const data = await this.corePrismaService.groups.create({
        data: {
          adminId,
          status: GroupStatus.inactive,
          ...dto,
        },
      });

      return {
        message: 'Group created successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to create group',
        data: null,
      });
    }
  }

  async findAll(dto: PageOptionsGroupDto) {
    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
      where: {
        status: dto.status,
      },
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.corePrismaService.groups.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.corePrismaService.groups.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    return {
      data: group,
    };
  }

  async update(adminId: number, id: number, dto: UpdateGroupDto) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this group',
        data: null,
      });
    }

    const updatedData = { ...group, ...dto };
    const hasChanges = JSON.stringify(updatedData) !== JSON.stringify(group);

    if (!hasChanges) {
      throw new BadRequestException({
        message: 'No changes were made to the group',
        data: null,
      });
    }

    try {
      const data = await this.corePrismaService.groups.update({
        where: {
          id,
        },
        data: {
          ...dto,
        },
      });

      return {
        message: 'Group updated successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to update group',
        data: null,
      });
    }
  }

  async inviteUser(dto: InviteUser2GroupDto) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id: dto.groupId,
      },
      include: {
        package: true,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    if (group.status !== GroupStatus.active) {
      throw new BadRequestException({
        message: 'Group is inactive',
        data: null,
      });
    }

    try {
      // Concurrently process invite for each email
      const invitePromises = dto.emails.map((email) =>
        this.processInviteUser(email, dto.groupId, dto.hostName),
      );
      await Promise.all(invitePromises);
      return {
        message: 'Invite user successfully',
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to invite user',
        data: null,
      });
    }
  }

  async processInviteUser(email: string, groupId: number, host: string) {
    const user = await this.authPrismaService.users.findFirst({
      where: {
        email: email,
      },
    });

    const token = !user
      ? await this.generateToken({
          email: email,
          role: null,
          groupId: groupId,
          sub: null,
        })
      : await this.generateToken({
          email: user.email,
          role: user.role,
          groupId: groupId,
          sub: user.id,
        });

    const templateData = {
      host: `${host}`,
      joinLink: undefined,
    };
    templateData.joinLink = !user
      ? `http://localhost:3000/login?token=${token.token}`
      : `http://localhost:3000/invite?token=${token.token}`;
    const data: SendMailTemplateDto = {
      toAddresses: [email],
      ccAddresses: [email],
      bccAddresses: [email],
      template: 'invite_user',
      templateData: JSON.stringify(templateData),
    };
    await this.mailService.sendEmailTemplate(data);
  }

  async adduserToGroup(email: string, groupId: number, userId: number) {
    const user = userId
      ? await this.authPrismaService.users.findFirst({
          where: {
            id: userId,
          },
        })
      : await this.authPrismaService.users.findFirst({
          where: {
            email: email,
          },
        });
    if (!user) {
      //send email
      throw new NotFoundException({
        message: 'User not found',
        data: null,
      });
    }
    if (user.email != email) {
      //send email
      throw new UnauthorizedException({
        message: 'Unauthorized',
        data: null,
      });
    }
    const memberShip = await this.corePrismaService.member_ships.findFirst({
      where: {
        userId: user.id,
        groupId: groupId,
      },
    });
    if (memberShip) {
      throw new BadRequestException({
        message: "User's already in group",
        data: null,
      });
    }
    return await this.corePrismaService.member_ships.create({
      data: {
        userId: user.id,
        groupId: groupId,
      },
    });
  }

  async activate(adminId: number, id: number) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id,
      },
      include: {
        package: true,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    if (group.status === GroupStatus.active) {
      throw new ConflictException({
        message: 'Group is already active',
        data: null,
      });
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException({
        message: 'You are not authorized to activate this group',
        data: null,
      });
    }

    try {
      const duration = group.package.duration;
      const data = await this.corePrismaService.groups.update({
        where: {
          id,
        },
        data: {
          status: GroupStatus.active,
          startDate: new Date(),
          endDate: new Date(
            new Date().setDate(new Date().getDate() + duration),
          ),
        },
      });

      return {
        message: 'Group activated successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to activate group',
        data: null,
      });
    }
  }

  async getJwtToInviteUserToGroup(
    sub: number,
    email: string,
    role: string,
    groupId: number,
  ): Promise<string> {
    const payload: ITokenPayload = { sub, email, role, groupId };
    const verificationToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_INVITE_USER_TO_GROUP_SECRET,
      expiresIn: process.env.JWT_INVITE_USER_TO_GROUP_EXPIRES,
    });
    return verificationToken;
  }

  private async generateToken(payload: ITokenPayload) {
    const token = await this.getJwtToInviteUserToGroup(
      payload.sub,
      payload?.email,
      payload.role,
      payload.groupId,
    );

    return {
      token,
    };
  }
}
