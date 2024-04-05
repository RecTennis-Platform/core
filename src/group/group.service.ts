import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GroupStatus, MemberRole } from '@prisma/client';
import { ITokenPayload } from 'src/auth_utils/interfaces';
import { MembershipService } from 'src/membership/membership.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMailTemplateDto } from 'src/services/mail/mail.dto';
import { MailService } from 'src/services/mail/mail.service';
import {
  CreateGroupDto,
  PageOptionsPostDto,
  PageOptionsUserDto,
  UpdateGroupDto,
} from './dto';
import { InviteUser2GroupDto } from './dto/invite-user.dto';
import {
  PageOptionsGroupDto,
  PageOptionsGroupMembershipDto,
} from './dto/page-options-group.dto';

@Injectable()
export class GroupService {
  constructor(
    private readonly mailService: MailService,
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
    private membershipService: MembershipService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}

  // Group
  async create(adminId: number, dto: CreateGroupDto) {
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: dto.purchasedPackageId,
          userId: adminId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Bought package not found',
        data: null,
      });
    }

    if (purchasedPackage.expired) {
      throw new BadRequestException({
        message: 'Bought package is expired',
        data: null,
      });
    }

    // NOTE: Use this if we need to check order of the bought package

    // const order = await this.prismaService.orders.findUnique({
    //   where: {
    //     id: purchasedPackage.orderId,
    //   },
    // });

    // if (!order) {
    //   throw new NotFoundException({
    //     message: 'Order not found',
    //     data: null,
    //   });
    // }

    // if (adminId !== order.userId) {
    //   throw new ForbiddenException({
    //     message: 'You are not authorized to create group',
    //     data: null,
    //   });
    // }

    const isUsed = await this.prismaService.groups.findFirst({
      where: {
        purchasedPackageId: dto.purchasedPackageId,
      },
    });

    if (isUsed) {
      throw new ConflictException({
        message: 'Bought package is already used',
        data: null,
      });
    }

    // Check if the bought package have the service include "Group" word

    const groupService = purchasedPackage.package.services.find((service) =>
      service.name.toLowerCase().includes('group'),
    );

    if (!groupService) {
      throw new BadRequestException({
        message: 'This package does not have the service to create group',
        data: null,
      });
    }

    const maxMember = JSON.parse(groupService.config).maxMember;

    try {
      const data = await this.prismaService.groups.create({
        data: {
          status: GroupStatus.active,
          maxMember,
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

  async findAllGroupsByUserId(
    userId: number,
    dto: PageOptionsGroupMembershipDto,
  ) {
    const conditions = {
      where: {
        userId,
        role: dto.role,
      },
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [groups, totalCount] = await Promise.all([
      this.prismaService.member_ships.findMany({
        include: {
          group: {
            select: {
              id: true,
              boughtPackageId: true,
              name: true,
              image: true,
              activityZone: true,
              language: true,
              description: true,
              status: true,
              maxMember: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  member_ships: true,
                },
              },
            },
          },
        },
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.member_ships.count({
        ...conditions,
      }),
    ]);

    // Modify the structure of the returned data
    const result = groups.map((group) => {
      const memberCount = group.group._count.member_ships;
      delete group.group._count;

      return {
        ...group.group,
        memberCount,
        isCreator: group.role === MemberRole.group_admin,
      };
    });

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findAllForAdmin(dto: PageOptionsGroupDto) {
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

    const [groups, totalCount] = await Promise.all([
      this.prismaService.groups.findMany({
        include: {
          _count: {
            select: {
              member_ships: true,
            },
          },
        },
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.groups.count({
        ...conditions,
      }),
    ]);

    // Modify the structure of the returned data
    const result = groups.map((group) => {
      const memberCount = group._count.member_ships;
      delete group._count;

      return {
        ...group,
        memberCount,
      };
    });

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(userId: number, groupId: number) {
    const groupWithMember = await this.prismaService.groups.findUnique({
      where: {
        id: groupId,
      },
      include: {
        member_ships: {
          where: {
            userId: userId,
          },
        },
      },
    });

    if (!groupWithMember) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    const member = groupWithMember.member_ships[0];
    if (!member) {
      throw new ForbiddenException({
        message: 'You are not a member of this group',
        data: null,
      });
    }

    const memberCount = await this.prismaService.member_ships.count({
      where: {
        groupId,
      },
    });

    delete groupWithMember.member_ships;

    return {
      ...groupWithMember,
      memberCount,
      isCreator: member.role === MemberRole.group_admin,
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

  // NOTE: If the group is expired, we will buy a new package to activate the group
  // async activate(adminId: number, groupId: number, purchasedPackageId: number) { // WILL USE THIS
  // async activate(adminId: number, id: number) {
  //   const group = await this.prismaService.groups.findUnique({
  //     where: {
  //       id,
  //     },
  //   });

  //   if (!group) {
  //     throw new NotFoundException({
  //       message: 'Group not found',
  //       data: null,
  //     });
  //   }

  //   // const order = await this.prismaService.orders.findUnique({
  //   //   where: {
  //   //     id: group.orderId,
  //   //   },
  //   //   include: {
  //   //     package: true,
  //   //   },
  //   // });

  //   // if (!order) {
  //   //   throw new NotFoundException({
  //   //     message: 'Order of this group not found',
  //   //     data: null,
  //   //   });
  //   // }

  //   // if (order.userId !== adminId) {
  //   //   throw new ForbiddenException({
  //   //     message: 'You are not authorized to activate this group',
  //   //     data: null,
  //   //   });
  //   // }

  //   // if (group.status === GroupStatus.active) {
  //   //   throw new ConflictException({
  //   //     message: 'Group is already active',
  //   //     data: null,
  //   //   });
  //   // }

  //   try {
  //     // const duration = order.package.duration;
  //     // const data = await this.prismaService.groups.update({
  //     //   where: {
  //     //     id,
  //     //   },
  //     //   data: {
  //     //     status: GroupStatus.active,
  //     //     startDate: new Date(),
  //     //     endDate: new Date(
  //     //       new Date().setDate(new Date().getDate() + duration),
  //     //     ),
  //     //   },
  //     // });

  //     return {
  //       message: 'Group activated successfully',
  //       //data,
  //     };
  //   } catch (error) {
  //     console.log('Error:', error.message);
  //     throw new BadRequestException({
  //       message: 'Failed to activate group',
  //       data: null,
  //     });
  //   }
  // }

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

  async findAllMembersByGroupId(
    userId: number,
    groupId: number,
    dto: PageOptionsUserDto,
  ) {
    // Check if the user is a member of the group
    const isMember = await this.prismaService.member_ships.findFirst({
      where: {
        userId,
        groupId,
      },
    });

    if (!isMember) {
      throw new ForbiddenException({
        message: 'You are not a member of this group',
        data: null,
      });
    }

    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
      where: {
        groupId,
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
      this.prismaService.member_ships.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.member_ships.count({
        ...conditions,
      }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async remove(adminId: number, groupId: number, userId: number) {
    // Check if the admin is a member of the group
    const isAdmin = await this.prismaService.member_ships.findFirst({
      where: {
        userId: adminId,
        groupId,
        role: MemberRole.group_admin,
      },
    });

    if (!isAdmin) {
      throw new ForbiddenException({
        message: 'You are not an admin of this group',
        data: null,
      });
    }

    // Check if the user is a member of the group
    const userIsMember = await this.prismaService.member_ships.findFirst({
      where: {
        userId: userId,
        groupId,
      },
    });

    if (!userIsMember) {
      throw new NotFoundException({
        message: 'This user is not a member of this group',
        data: null,
      });
    }

    try {
      await this.prismaService.member_ships.delete({
        where: {
          userId_groupId: {
            groupId,
            userId,
          },
        },
      });

      return {
        message: 'Member removed successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to remove the member',
        data: null,
      });
    }
  }
}
