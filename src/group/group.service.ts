import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GroupStatus, MemberRole } from '@prisma/client';
import { ITokenPayload } from 'src/auth_utils/interfaces';
import { MembershipService } from 'src/membership/membership.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMailTemplateDto } from 'src/services/mail/mail.dto';
import { MailService } from 'src/services/mail/mail.service';
import { CreateGroupDto, PageOptionsPostDto, UpdateGroupDto } from './dto';
import { InviteUser2GroupDto } from './dto/invite-user.dto';
import { PageOptionsGroupDto } from './dto/page-options-group.dto';

@Injectable()
export class GroupService {
  constructor(
    private readonly mailService: MailService,
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
    private membershipService: MembershipService,
  ) {}

  // Group
  async create(adminId: number, dto: CreateGroupDto) {
    const order = await this.prismaService.orders.findUnique({
      where: {
        id: dto.boughtPackageId,
      },
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        data: null,
      });
    }

    if (adminId !== order.userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to create group',
        data: null,
      });
    }

    const isUsed = await this.prismaService.groups.findFirst({
      where: {
        boughtPackageId: dto.boughtPackageId,
      },
    });

    if (isUsed) {
      throw new ConflictException({
        message: 'This order already has a group',
        data: null,
      });
    }

    try {
      const data = await this.prismaService.groups.create({
        data: {
          status: GroupStatus.inactive,
          ...dto,
        },
      });

      // Create membership
      await this.membershipService.create({
        userId: adminId,
        groupId: data.id,
        role: MemberRole.group_admin,
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
      this.prismaService.groups.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.groups.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    const group = await this.prismaService.groups.findUnique({
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
    const group = await this.prismaService.groups.findUnique({
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

    // const order = await this.prismaService.orders.findUnique({
    //   where: {
    //     id: group.referenceId,
    //   },
    // });

    // if (!order) {
    //   throw new NotFoundException({
    //     message: 'Order of this group not found',
    //     data: null,
    //   });
    // }

    // if (order.userId !== adminId) {
    //   throw new ForbiddenException({
    //     message: 'You are not authorized to update this group',
    //     data: null,
    //   });
    // }

    const updatedData = { ...group, ...dto };
    const hasChanges = JSON.stringify(updatedData) !== JSON.stringify(group);

    if (!hasChanges) {
      throw new BadRequestException({
        message: 'No changes were made to the group',
        data: null,
      });
    }

    try {
      const data = await this.prismaService.groups.update({
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
    const group = await this.prismaService.groups.findUnique({
      where: {
        id: dto.groupId,
      },
      // include: {
      //   package: true,
      // },
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
    const user = await this.prismaService.users.findFirst({
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

  async addUserToGroup(email: string, groupId: number, userId: number) {
    const user = userId
      ? await this.prismaService.users.findFirst({
          where: {
            id: userId,
          },
        })
      : await this.prismaService.users.findFirst({
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
    const memberShip = await this.prismaService.member_ships.findFirst({
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
    return await this.prismaService.member_ships.create({
      data: {
        userId: user.id,
        groupId: groupId,
      },
    });
  }

  async activate(adminId: number, id: number) {
    const group = await this.prismaService.groups.findUnique({
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

    // const order = await this.prismaService.orders.findUnique({
    //   where: {
    //     id: group.orderId,
    //   },
    //   include: {
    //     package: true,
    //   },
    // });

    // if (!order) {
    //   throw new NotFoundException({
    //     message: 'Order of this group not found',
    //     data: null,
    //   });
    // }

    // if (order.userId !== adminId) {
    //   throw new ForbiddenException({
    //     message: 'You are not authorized to activate this group',
    //     data: null,
    //   });
    // }

    // if (group.status === GroupStatus.active) {
    //   throw new ConflictException({
    //     message: 'Group is already active',
    //     data: null,
    //   });
    // }

    try {
      // const duration = order.package.duration;
      // const data = await this.prismaService.groups.update({
      //   where: {
      //     id,
      //   },
      //   data: {
      //     status: GroupStatus.active,
      //     startDate: new Date(),
      //     endDate: new Date(
      //       new Date().setDate(new Date().getDate() + duration),
      //     ),
      //   },
      // });

      return {
        message: 'Group activated successfully',
        //data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to activate group',
        data: null,
      });
    }
  }

  // Group Post
  async getPosts(groupId: number, pageOptionsPostDto: PageOptionsPostDto) {
    // Check if group exists
    const group = await this.prismaService.groups.findUnique({
      where: {
        id: groupId,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsPostDto.order,
        },
      ],
      where: {
        groupId,
      },
    };

    const pageOption =
      pageOptionsPostDto.page && pageOptionsPostDto.take
        ? {
            skip: pageOptionsPostDto.skip,
            take: pageOptionsPostDto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.posts.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.posts.count({
        where: {
          groupId,
        },
      }),
    ]);

    return {
      message: 'Group posts fetched successfully',
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsPostDto.take),
      totalCount,
    };
  }

  async getPostDetails(groupId: number, postId: number) {
    // Check if group exists
    const group = await this.prismaService.groups.findUnique({
      where: {
        id: groupId,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    // Check if post exists
    const post = await this.prismaService.posts.findUnique({
      where: {
        id: postId,
      },
    });

    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
        data: null,
      });
    }

    return {
      message: 'Post details fetched successfully',
      data: post,
    };
  }

  // async createPost(userId: number, groupId: number) {
  //   // Check if group exists
  //   const group = await this.prismaService.groups.findUnique({
  //     where: {
  //       id: groupId,
  //     },
  //   });

  //   if (!group) {
  //     throw new NotFoundException({
  //       message: 'Group not found',
  //       data: null,
  //     });
  //   }

  //   // Check if user is a member of the group
  //   const member = await this.prismaService.members.findFirst({
  //     where: {
  //       userId,
  //       groupId,
  //     },
  //   });

  //   if (!member) {
  //     throw new ForbiddenException({
  //       message: 'You are not a member of this group',
  //       data: null,
  //     });
  //   }

  //   try {
  //     // const data = await this.prismaService.posts.create({
  //     //   data: {
  //     //     userId,
  //     //     groupId,
  //     //   },
  //     // });

  //     return {
  //       message: 'Post created successfully',
  //       // data,
  //     };
  //   } catch (error) {
  //     console.log('Error:', error.message);
  //     throw new BadRequestException({
  //       message: 'Failed to create post',
  //       data: null,
  //     });
  //   }
  // }

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
