import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import {
  GroupStatus,
  MemberRole,
  ParticipantType,
  GroupTournamentPhase,
  RegistrationStatus,
  GroupTournamentStatus,
  GroupTournamentFormat,
  TournamentFormat,
  Prisma,
  MatchStatus,
  FixtureStatus,
  TournamentPhase,
  GroupFundStatus,
  ExpenseType,
} from '@prisma/client';
import { ITokenPayload } from 'src/auth_utils/interfaces';
import { MembershipService } from 'src/membership/membership.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMailTemplateDto } from 'src/services/mail/mail.dto';
import { MailService } from 'src/services/mail/mail.service';

import {
  ConfirmGroupFundRequestDto,
  CreateGroupDto,
  CreateGroupExpenseDto,
  CreateGroupFundDto,
  CreateUserFundRequestDto,
  PageOptionsGroupExpenseDto,
  PageOptionsGroupFundDto,
  PageOptionsPostDto,
  PageOptionsUserDto,
  UpdateGroupDto,
} from './dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { AddUser2GroupDto } from './dto/add-user-to-group.dto';
import { CreateGroupTournamentDto } from './dto/create-group-tournament.dto';
import { InviteUser2GroupDto } from './dto/invite-user.dto';
import { PageOptionsGroupTournamentDto } from './dto/page-options-group-tournament.dto';
import {
  PageOptionsGroupDto,
  PageOptionsGroupMembershipDto,
} from './dto/page-options-group.dto';
import { PageOptionsParticipantsDto } from './dto/page-options-participants.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CustomResponseStatusCodes } from 'src/helper/custom-response-status-code';
import { CustomResponseMessages } from 'src/helper/custom-response-message';
import { TournamentRole } from 'src/tournament/tournament.enum';
import {
  CreateFixtureDto,
  GenerateFixtureDto,
} from 'src/fixture/dto/create-fixture.dto';
import { FormatTournamentService } from 'src/services/format_tournament/format_tournament.service';
import { randomUUID } from 'crypto';
import { FixtureService } from 'src/fixture/fixture.service';
import { RefereesTournamentsService } from 'src/referees_tournaments/referees_tournaments.service';
import {
  PageOptionsRefereesGroupTournamentsDto,
  PageOptionsRefereesTournamentsDto,
} from 'src/referees_tournaments/dto/page-options-referees-tournaments.dto';
import {
  CreateRefereesGroupTournamentDto,
  CreateRefereesTournamentDto,
} from 'src/referees_tournaments/dto/create-referees_tournament.dto';
import {
  PageOptionsTournamentRegistrationDto,
  UpdateGroupTournamentDto,
} from 'src/tournament/dto';
import { CreatePostDto, UpdatePostDto } from './dto/create-post-dto';
import { Order } from 'constants/order';
import { VND_EXCHANGE_RATE } from 'constants/currency-prices';
import { NotificationProducer } from 'src/services/notification/notification-producer';

@Injectable()
export class GroupService {
  constructor(
    private readonly mailService: MailService,
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
    private membershipService: MembershipService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
    private readonly formatTournamentService: FormatTournamentService,
    private readonly fixtureService: FixtureService,
    private readonly refereesTournamentsService: RefereesTournamentsService,
    private readonly notificationProducer: NotificationProducer,
    @InjectQueue('send-mail') private sendMailQueue: Queue,
  ) {}

  // Validation functions
  private async checkPurchasePackage(purchasedPackageId: string) {
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: purchasedPackageId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Bought package not found',
        data: null,
      });
    }

    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        message: 'Bought package is expired',
        data: null,
      });
    }

    return purchasedPackage;
  }

  private async checkValidGroup(groupId: number) {
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

    const purchasedPackage = await this.checkPurchasePackage(
      group.purchasedPackageId,
    );

    return { ...group, purchasedPackage: purchasedPackage };
  }

  private async checkMember(
    userId: string,
    groupId: number,
    isAdmin?: boolean,
  ) {
    const member = await this.prismaService.member_ships.findFirst({
      where: {
        userId,
        groupId,
      },
    });

    if (!member) {
      throw new ForbiddenException({
        message: 'You are not a member of this group',
        data: null,
      });
    }

    if (isAdmin && member.role !== MemberRole.group_admin) {
      throw new ForbiddenException({
        message: 'You are not an admin of this group',
        data: null,
      });
    }

    return member;
  }

  // Group
  async create(adminId: string, dto: CreateGroupDto) {
    const purchasedPackage = await this.checkPurchasePackage(
      dto.purchasedPackageId,
    );

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

    // const isUsed = await this.prismaService.groups.findFirst({
    //   where: {
    //     purchasedPackageId: dto.purchasedPackageId,
    //   },
    // });

    // if (isUsed) {
    //   throw new ConflictException({
    //     message: 'Bought package is already used',
    //     data: null,
    //   });
    // }

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

    const maxMembers = JSON.parse(groupService.config).maxMembers;
    const count = await this.prismaService.groups.count({
      where: {
        purchasedPackageId: dto.purchasedPackageId,
      },
    });
    if (count >= JSON.parse(groupService.config).maxGroups) {
      throw new BadRequestException({
        message: 'Exceeded the allowed number of groups',
        data: null,
      });
    }

    try {
      const data = await this.prismaService.groups.create({
        data: {
          status: GroupStatus.active,
          maxMembers,
          ...dto,
        },
      });

      // Create membership
      await this.membershipService.create({
        userId: adminId,
        groupId: data.id,
        role: MemberRole.group_admin,
      });

      //update purchased service
      const newServices = purchasedPackage.package.services.map((service) => {
        if (service.name.toLowerCase().includes('group')) {
          const serviceConfig = JSON.parse(service.config);
          serviceConfig.used += 1;
          service.config = JSON.stringify(serviceConfig);
        }
        return service;
      });
      purchasedPackage.package.services = newServices;

      await this.mongodbPrismaService.purchasedPackage.update({
        where: {
          id: purchasedPackage.id,
        },
        data: {
          package: purchasedPackage.package,
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

  async findAllGroupsByUserId(
    userId: string,
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
              purchasedPackageId: true,
              name: true,
              image: true,
              activityZone: true,
              language: true,
              description: true,
              status: true,
              maxMembers: true,
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
    const result = await Promise.all(
      groups.map(async (group) => {
        const memberCount = group.group._count.member_ships;
        const purchasedPackage =
          await this.mongodbPrismaService.purchasedPackage.findFirst({
            where: {
              id: group.group.purchasedPackageId,
            },
          });
        if (new Date(purchasedPackage.endDate) < new Date()) {
          group.group.status = 'expired';
        }
        delete group.group._count;

        return {
          ...group.group,
          memberCount,
          isCreator: group.role === MemberRole.group_admin,
        };
      }),
    );

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

  async findOne(userId: string, groupId: number) {
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

  async update(adminId: string, id: number, dto: UpdateGroupDto) {
    const group = await this.checkValidGroup(id);

    await this.checkMember(adminId, id, true);

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

  // Invite User
  async inviteUser(userId: string, dto: InviteUser2GroupDto) {
    const group = await this.checkValidGroup(dto.groupId);
    const userGroup = await this.prismaService.member_ships.findFirst({
      where: {
        userId: userId,
        groupId: dto.groupId,
      },
      include: {
        group: true,
      },
    });

    if (!userGroup) {
      throw new NotFoundException({
        message: 'Group not found or User is not in group',
        data: null,
      });
    }

    if (userGroup.group.status !== GroupStatus.active) {
      throw new BadRequestException({
        message: 'Group is inactive',
        data: null,
      });
    }

    try {
      const token = await this.generateToken({
        email: dto.email,
        groupId: dto.groupId,
        sub: null,
      });
      const user = await this.prismaService.users.findFirst({
        where: {
          email: dto.email,
        },
      });

      const link = user
        ? `${process.env.INVITE_USER_TO_GROUP_LINK}?token=${token.token}`
        : `${process.env.INVITE_UNREGISTERED_USER_TO_GROUP_LINK}?token=${token.token}`;
      const templateData = {
        host: `${dto.hostName}`,
        joinLink: link,
      };
      const data: SendMailTemplateDto = {
        toAddresses: [dto.email],
        ccAddresses: [dto.email],
        bccAddresses: [dto.email],
        template: 'invite_user',
        templateData: JSON.stringify(templateData),
      };
      await this.sendMailQueue.add(data);
      if (user) {
        const notification = {
          title: 'Group Invitation',
          body: `You have been invited to join the group ${group.name}. Please check your email to accept the invitation and get started.`,
        };
        const notiData = {
          //mobileType: 'MATCH_UPDATE',
          type: 'group_member',
          params: {
            groupId: group.id,
          },
          notification,
          web: true,
          mobile: true,
        };
        const notificationData = {
          userIds: [user.id],
          notiData,
        };
        await this.notificationProducer.add(notificationData);
      }
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
          groupId: groupId,
          sub: null,
        })
      : await this.generateToken({
          email: user.email,
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

  async addUserToGroup(userId: string, dto: AddUser2GroupDto) {
    const user = await this.prismaService.users.findFirst({
      where: {
        id: userId,
      },
    });
    if (!user) {
      //send email
      throw new NotFoundException({
        message: 'User not found',
        data: null,
      });
    }

    try {
      this.jwtService.verify(dto.token, {
        secret: process.env.JWT_INVITE_USER_TO_GROUP_SECRET,
      });
    } catch (error) {
      if (
        error instanceof JsonWebTokenError &&
        error.message.includes('invalid signature')
      ) {
        throw new UnauthorizedException({
          message: 'Invalid Token',
        });
      } else if (
        error instanceof JsonWebTokenError &&
        error.message.includes('expired')
      ) {
        throw new ForbiddenException('Token has expired');
      }
    }
    const decoded = await this.jwtService.decode(dto.token);

    if (user.email != decoded.email) {
      throw new ForbiddenException(
        'User must login to system by using correct email',
      );
    }

    const memberShip = await this.prismaService.member_ships.findFirst({
      where: {
        userId: user.id,
        groupId: decoded.groupId,
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
        groupId: decoded.groupId,
      },
    });
  }

  // NOTE: If the group is expired, we will buy a new package to activate the group
  // async activate(adminId: string, groupId: number, purchasedPackageId: number) { // WILL USE THIS
  // async activate(adminId: string, id: number) {
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
        include: {
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              name: true,
              role: true,
              phoneNumber: true,
              gender: true,
              elo: true,
            },
          },
        },
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
      include: {
        user: {
          select: {
            id: true,
            email: true,
            image: true,
            name: true,
            role: true,
            phoneNumber: true,
            gender: true,
            elo: true,
          },
        },
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

  async createPost(userId: string, groupId: number, dto: CreatePostDto) {
    // Check if group exists
    await this.checkValidGroup(groupId);
    await this.checkMember(userId, groupId);

    try {
      return await this.prismaService.posts.create({
        data: {
          userId,
          groupId,
          content: dto.content,
          image: dto.image,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              name: true,
              role: true,
              phoneNumber: true,
              gender: true,
              elo: true,
            },
          },
        },
      });
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to create post',
        data: null,
      });
    }
  }

  async updatePost(
    userId: string,
    groupId: number,
    postId: number,
    dto: UpdatePostDto,
  ) {
    // Check if group exists
    await this.checkValidGroup(groupId);
    const member = await this.checkMember(userId, groupId);
    const post = await this.prismaService.posts.findFirst({
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
    if (post.userId != member.userId && member.role != MemberRole.group_admin) {
      throw new BadRequestException({
        message: 'Access Denied',
        data: null,
      });
    }

    return await this.prismaService.posts.update({
      where: {
        id: postId,
      },
      data: {
        content: dto.content,
        image: dto.image,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            image: true,
            name: true,
            role: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  async deletePost(userId: string, groupId: number, postId: number) {
    // Check if group exists
    await this.checkValidGroup(groupId);
    const member = await this.checkMember(userId, groupId);
    const post = await this.prismaService.posts.findFirst({
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

    if (post.userId != member.userId && member.role != MemberRole.group_admin) {
      throw new BadRequestException({
        message: 'Access Denied',
        data: null,
      });
    }

    return await this.prismaService.posts.delete({
      where: {
        id: postId,
      },
    });
  }

  async getJwtToInviteUserToGroup(
    sub: string,
    email: string,
    groupId: number,
  ): Promise<string> {
    const payload: ITokenPayload = { sub, email, groupId };
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
      payload.groupId,
    );

    return {
      token,
    };
  }

  // Group Member
  async findAllMembersByGroupId(
    userId: string,
    groupId: number,
    dto: PageOptionsUserDto,
  ) {
    await this.checkValidGroup(groupId);

    await this.checkMember(userId, groupId);

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
              gender: true,
              elo: true,
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

  async removeMember(adminId: string, groupId: number, userId: string) {
    await this.checkValidGroup(groupId);

    await this.checkMember(adminId, groupId, true);

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

  // Group Tournament
  // Note: Need to limit the number of current tournaments (ongoing and upcoming)?
  async createGroupTournament(
    userId: string,
    groupId: number,
    dto: CreateGroupTournamentDto,
  ) {
    const group = await this.checkValidGroup(groupId);

    await this.checkMember(userId, groupId, true);

    try {
      const data = await this.prismaService.group_tournaments.create({
        data: {
          groupId,
          ...dto,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          maxParticipants: group.maxMembers,
        },
      });

      return {
        message: 'Group tournament created successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to create group tournament',
        data: null,
      });
    }
  }

  async getGroupTournaments(
    userId: string,
    groupId: number,
    dto: PageOptionsGroupTournamentDto,
  ) {
    await this.checkValidGroup(groupId);

    const member = await this.checkMember(userId, groupId);

    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
    };

    let result;
    if (member.role === MemberRole.group_admin) {
      result = await this.prismaService.group_tournaments.findMany({
        where: {
          groupId,
          status: dto.status,
        },
        ...conditions,
      });
    } else {
      result = await this.prismaService.group_tournaments.findMany({
        where: {
          groupId,
          NOT: {
            phase: GroupTournamentPhase.new,
          },
          status: dto.status,
        },
        ...conditions,
      });
    }
    // Modify the structure of the returned data
    const modified_result = await Promise.all(
      result.map(async (tournament) => {
        const participantCountUser1 =
          await this.prismaService.group_tournament_registrations.count({
            where: {
              groupTournamentId: tournament.id,
            },
          });

        const participantCount = participantCountUser1;
        delete tournament._count;

        return {
          ...tournament,
          participants: participantCount,
        };
      }),
    );

    return modified_result;
  }

  async getGroupTournamentGeneralInfo(
    userId: string,
    groupId: number,
    tournamentId: number,
  ) {
    await this.checkValidGroup(groupId);

    const member = await this.checkMember(userId, groupId);

    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
      include: {
        group: true,
      },
    });

    if (
      !tournament ||
      (member.role === MemberRole.member &&
        tournament.phase === GroupTournamentPhase.new)
    ) {
      throw new NotFoundException({
        message: 'Tournament not found',
        data: null,
      });
    }

    const participants =
      await this.prismaService.group_tournament_registrations.count({
        where: {
          groupTournamentId: tournamentId,
        },
      });

    delete tournament.group.purchasedPackageId;

    return {
      ...tournament,
      participants,
      isCreator: member.role === MemberRole.group_admin,
    };
  }

  async getGroupTournamentParticipants(
    userId: string,
    groupId: number,
    tournamentId: number,
    dto: PageOptionsParticipantsDto,
  ) {
    await this.checkValidGroup(groupId);

    const member = await this.checkMember(userId, groupId);

    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (
      !tournament ||
      (member.role === MemberRole.member &&
        tournament.phase === GroupTournamentPhase.new)
    ) {
      throw new NotFoundException({
        message: 'Tournament not found',
        data: null,
      });
    }

    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.group_tournament_registrations.findMany({
        where: {
          groupTournamentId: tournamentId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              gender: true,
              elo: true,
            },
          },
        },
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.group_tournament_registrations.count({
        where: {
          groupTournamentId: tournamentId,
        },
        ...conditions,
      }),
    ]);

    const participants = result.map((participant) => {
      return {
        ...participant,
        user: {
          ...participant.user,
          role:
            participant.userId === userId &&
            member.role === MemberRole.group_admin
              ? MemberRole.group_admin
              : MemberRole.member,
        },
      };
    });

    return {
      data: participants,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
      isCreator: member.role === MemberRole.group_admin,
    };
  }

  async getGroupTournamentNonParticipants(
    userId: string,
    groupId: number,
    tournamentId: number,
  ) {
    await this.checkValidGroup(groupId);

    const member = await this.checkMember(userId, groupId);

    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (
      !tournament ||
      (member.role === MemberRole.member &&
        tournament.phase === GroupTournamentPhase.new)
    ) {
      throw new NotFoundException({
        message: 'Tournament not found',
        data: null,
      });
    }

    if (member.role === MemberRole.member) {
      const isParticipant =
        await this.prismaService.group_tournament_registrations.findFirst({
          where: {
            userId,
            groupTournamentId: tournamentId,
          },
        });

      if (!isParticipant) {
        throw new ForbiddenException({
          message: 'You are not a participant of this tournament',
          data: null,
        });
      }
    }

    const participants =
      await this.prismaService.group_tournament_registrations.findMany({
        where: {
          groupTournamentId: tournamentId,
        },
        select: {
          userId: true,
        },
      });

    const referees =
      await this.prismaService.referees_group_tournaments.findMany({
        where: {
          groupTournamentId: tournamentId,
        },
      });
    const refereeIds = referees.map((referee) => referee.refereeId);
    const participantIds = participants.map(
      (participant) => participant.userId,
    );
    const nonParticipants = await this.prismaService.member_ships.findMany({
      where: {
        groupId,
        NOT: {
          userId: {
            in: refereeIds.concat(participantIds),
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            gender: true,
            elo: true,
          },
        },
      },
    });

    const result = nonParticipants.map((participant) => {
      return {
        ...participant.user,
        role: participant.role,
      };
    });

    return result;
  }

  async addGroupTournamentParticipant(
    userId: string,
    groupId: number,
    tournamentId: number,
    dto: AddParticipantsDto,
  ) {
    await this.checkValidGroup(groupId);

    await this.checkMember(userId, groupId, true);

    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        message: 'Tournament not found, cannot add participant',
        data: null,
      });
    }

    // dto.userIds is a list of user ids need to be added to the tournament
    // Check if the user ids are members of the group
    const members = await this.prismaService.member_ships.findMany({
      where: {
        groupId,
        userId: {
          in: dto.userIds,
        },
      },
    });

    if (members.length !== dto.userIds.length) {
      throw new NotFoundException({
        message: 'Some users are not members of this group',
        data: null,
      });
    }

    // Check if the user ids are already participants of the tournament
    const participants =
      await this.prismaService.group_tournament_registrations.findMany({
        where: {
          groupTournamentId: tournamentId,
          userId: {
            in: dto.userIds,
          },
        },
      });

    if (participants.length > 0) {
      throw new ConflictException({
        message: 'Some users are already participants of this tournament',
        data: null,
      });
    }

    try {
      await this.prismaService.group_tournament_registrations.createMany({
        data: dto.userIds.map((userId) => {
          return {
            userId,
            groupTournamentId: tournamentId,
          };
        }),
      });

      return {
        message: 'Participants added successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to add participants',
        data: null,
      });
    }
  }

  async removeGroupTournamentParticipant(
    userId: string,
    groupId: number,
    tournamentId: number,
    participantId: string,
  ) {
    await this.checkValidGroup(groupId);

    await this.checkMember(userId, groupId, true);

    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        message: 'Tournament not found, cannot remove participant',
        data: null,
      });
    }

    const participant =
      await this.prismaService.group_tournament_registrations.findFirst({
        where: {
          userId: participantId,
          groupTournamentId: tournamentId,
        },
      });

    if (!participant) {
      throw new NotFoundException({
        message: 'Participant not found',
        data: null,
      });
    }

    try {
      await this.prismaService.group_tournament_registrations.delete({
        where: {
          groupTournamentId_userId: {
            groupTournamentId: tournamentId,
            userId: participantId,
          },
        },
      });

      return {
        message: 'Participant removed successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to remove the participant',
        data: null,
      });
    }
  }

  async removeGroupTournamentReferee(
    userId: string,
    groupId: number,
    tournamentId: number,
    refereeId: string,
  ) {
    await this.checkValidGroup(groupId);

    await this.checkMember(userId, groupId, true);

    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        message: 'Tournament not found, cannot remove participant',
        data: null,
      });
    }

    const referee =
      await this.prismaService.referees_group_tournaments.findFirst({
        where: {
          refereeId: refereeId,
          groupTournamentId: tournamentId,
        },
      });

    if (!referee) {
      throw new NotFoundException({
        message: 'Participant not found',
        data: null,
      });
    }

    try {
      await this.prismaService.referees_group_tournaments.delete({
        where: {
          groupTournamentId_refereeId: {
            groupTournamentId: tournamentId,
            refereeId: refereeId,
          },
        },
      });

      return {
        message: 'Referee removed successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to remove the referee',
        data: null,
      });
    }
  }

  async getTournamentsList(pageOptions: PageOptionsGroupTournamentDto) {
    // Build page options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {},
    };

    if (pageOptions.gender) {
      conditions.where['gender'] = pageOptions.gender;
    }

    if (pageOptions.format) {
      conditions.where['format'] = pageOptions.format;
    }

    if (pageOptions.participantType) {
      conditions.where['participantType'] = pageOptions.participantType;
      if (pageOptions.participantType === ParticipantType.mixed_doubles) {
        conditions.where['gender'] = null;
      }
    }

    if (pageOptions.status) {
      conditions.where['status'] = pageOptions.status;
    }

    if (pageOptions.phase) {
      if (pageOptions.phase !== GroupTournamentPhase.new) {
        conditions.where['phase'] = pageOptions.phase;
      } else {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          ),
          data: null,
        });
      }
    } else {
      conditions.where['NOT'] = {
        phase: GroupTournamentPhase.new,
      };
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get all tournaments
    const [result, totalCount] = await Promise.all([
      this.prismaService.group_tournaments.findMany({
        ...conditions,
        ...pageOption,
        include: {
          _count: {
            select: {
              group_tournament_registrations: true,
            },
          },
        },
      }),
      this.prismaService.group_tournaments.count(conditions),
    ]);

    // Modify the structure of the returned data
    const modified_result = await Promise.all(
      result.map(async (tournament) => {
        const participantCountUser1 =
          await this.prismaService.group_tournament_registrations.count({
            where: {
              groupTournamentId: tournament.id,
            },
          });

        const participantCount = participantCountUser1;
        delete tournament._count;

        return {
          ...tournament,
          participants: participantCount,
        };
      }),
    );

    return {
      data: modified_result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  // For normal usage
  async getTournamentDetails(
    userId: string | undefined,
    tournamentId: number,
    groupId: number,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Get purchased package info
    const group = await this.checkValidGroup(groupId);
    const tournamentRoles = [];
    if (userId) {
      const user = await this.prismaService.users.findFirst({
        where: {
          id: userId,
        },
        include: {
          referees_group_tournaments: true,
        },
      });
      const participant =
        await this.prismaService.group_tournament_registrations.findFirst({
          where: {
            OR: [
              {
                userId: userId,
              },
            ],
          },
        });
      const member = await this.checkMember(userId, groupId);
      // Check if the user is the creator of the tournament
      if (member.role === MemberRole.group_admin) {
        tournamentRoles.push(TournamentRole.CREATOR);
      } else if (user.referees_group_tournaments.length > 0) {
        // Check if the user is the referee of the tournament
        const referees = user.referees_group_tournaments.filter((r) => {
          return r.groupTournamentId === tournamentId;
        });
        if (referees.length > 0) {
          tournamentRoles.push(TournamentRole.REFEREE);
        }
      } else if (participant) {
        tournamentRoles.push(TournamentRole.PARTICIPANT);
      }
      if (tournamentRoles.length === 0) {
        tournamentRoles.push(TournamentRole.VIEWER);
      }
    } else {
      tournamentRoles.push(TournamentRole.VIEWER);
    }

    // Parse the config field for each service in the services array
    const parsedServices = group.purchasedPackage.package.services.map(
      (service) => {
        const config = JSON.parse(service.config);
        return {
          ...service,
          config: config,
        };
      },
    );

    //count number of participants
    const participantCountUser1 =
      await this.prismaService.group_tournament_registrations.count({
        where: {
          groupTournamentId: tournament.id,
        },
      });

    const participantCount = participantCountUser1;

    // Build response data
    delete tournament.createdAt;
    delete tournament.updatedAt;

    const response_data = {
      ...tournament,
      purchasedPackage: {
        id: group.purchasedPackage.id,
        name: group.purchasedPackage.package.name,
        services: parsedServices,
      },
      participants: participantCount,
      tournamentRoles,
    };

    return {
      message: 'Get tournament details successfully',
      data: response_data,
    };
  }

  async getMyTournaments(
    userId: string,
    pageOptions: PageOptionsGroupTournamentDto,
    groupId: number,
  ) {
    // Get user's purchased packages
    const purchasedPackages =
      await this.mongodbPrismaService.purchasedPackage.findMany({
        where: {
          userId: userId,
          endDate: {
            gt: new Date(), // Not expired purchased packages
          },
        },
      });

    // Get purchased packages that have the "Tournament" service
    const filteredPurchasedPackages = purchasedPackages.filter(
      (purchasedPackage) =>
        purchasedPackage.package.services.some(
          (service) => service.name.toLowerCase().includes('group') === true,
        ),
    );

    // Get purchased packages id
    const purchasedPackageIds = filteredPurchasedPackages.map(
      (purchasedPackage) => purchasedPackage.id,
    );

    const groups = await this.prismaService.groups.findMany({
      where: {
        purchasedPackageId: {
          in: purchasedPackageIds,
        },
      },
    });

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupId: groupId,
      },
    };

    if (pageOptions.gender) {
      conditions.where['gender'] = pageOptions.gender;
    }

    if (pageOptions.format) {
      conditions.where['format'] = pageOptions.format;
    }

    if (pageOptions.participantType) {
      conditions.where['participantType'] = pageOptions.participantType;
      if (pageOptions.participantType === ParticipantType.mixed_doubles) {
        conditions.where['gender'] = null;
      }
    }

    if (pageOptions.status) {
      conditions.where['status'] = pageOptions.status;
    }

    if (pageOptions.phase) {
      conditions.where['phase'] = pageOptions.phase;
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get tournaments that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.group_tournaments.findMany({
        ...conditions,
        ...pageOption,
        include: {
          _count: {
            select: {
              group_tournament_registrations: true,
            },
          },
        },
      }),
      this.prismaService.group_tournaments.count(conditions),
    ]);

    // Modify the structure of the returned data
    const modified_result = await Promise.all(
      result.map(async (tournament) => {
        const participantCountUser1 =
          await this.prismaService.group_tournament_registrations.count({
            where: {
              groupTournamentId: tournament.id,
            },
          });

        const participantCount = participantCountUser1;
        delete tournament._count;

        return {
          ...tournament,
          participants: participantCount,
        };
      }),
    );

    return {
      data: modified_result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async getUnregisteredTournaments(
    userId: string,
    pageOptions: PageOptionsGroupTournamentDto,
    groupId: number,
  ) {
    //// Get tournament registrations that the user has registered
    const groupTournaments =
      await this.prismaService.group_tournaments.findMany({
        where: {
          groupId: groupId,
        },
      });
    const groupTournamentsId = groupTournaments.map((value) => {
      return value.id;
    });
    const userTournamentRegistrations =
      await this.prismaService.group_tournament_registrations.findMany({
        where: {
          OR: [
            {
              userId: userId,
            },
          ],
          groupTournamentId: { in: groupTournamentsId },
        },
        select: {
          groupTournamentId: true,
        },
      });

    // Map to get only tournamentId as an array
    const userRegisteredTournamentIds = userTournamentRegistrations.map(
      (registration) => registration.groupTournamentId,
    );

    //// Get this user's created tournaments
    // Get user's purchased package
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        NOT: {
          OR: [{ id: { in: userRegisteredTournamentIds } }],
        },
        status: GroupTournamentStatus.upcoming,
        phase: GroupTournamentPhase.published,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get user's tournament registrations (participated)
    const [result, totalCount] = await Promise.all([
      this.prismaService.group_tournaments.findMany({
        ...conditions,
        ...pageOption,
        where: {
          groupId: groupId,
        },
      }),
      this.prismaService.group_tournaments.count(conditions),
    ]);

    // Get each tournament participants count
    for (const tournament of result) {
      tournament['participants'] = await this.getTournamentParticipantsCount(
        tournament.id,
      );
    }

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async publishTournament(
    userId: string,
    tournamentId: number,
    groupId: number,
    unpublish: boolean = false,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Get purchased package info
    const group = await this.checkValidGroup(groupId);

    // Check expiration date of the purchased package
    if (new Date(group.purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (group.purchasedPackage.userId !== userId) {
      if (unpublish) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_UNAUTHORIZED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_UNAUTHORIZED,
          ),
          data: null,
        });
      } else {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_UNAUTHORIZED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_UNAUTHORIZED,
          ),
          data: null,
        });
      }
    }

    // Update tournament status
    try {
      await this.prismaService.group_tournaments.update({
        where: {
          id: tournamentId,
        },
        data: {
          phase: unpublish
            ? GroupTournamentPhase.new
            : GroupTournamentPhase.published,
        },
      });

      return {};
    } catch (error) {
      console.log('Error:', error.message);
      if (unpublish) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_FAILED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_UNPUBLISHED_FAILED,
          ),
          data: null,
        });
      } else {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_FAILED,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_PUBLISHED_FAILED,
          ),
          data: null,
        });
      }
    }
  }

  async generateFixture(id: number, dto: GenerateFixtureDto) {
    const tournament = await this.prismaService.group_tournaments.findFirst({
      where: {
        id: id,
      },
    });
    const format = tournament?.format;
    try {
      if (
        format === GroupTournamentFormat.round_robin ||
        format === GroupTournamentFormat.knockout
      ) {
        const teams = await this.prismaService.teams.findMany({
          where: {
            groupTournamentId: id,
          },
          orderBy: [
            { seed: Prisma.SortOrder.asc },
            { totalElo: Prisma.SortOrder.desc },
          ],
          include: {
            user1: {
              select: {
                id: true,
                image: true,
                name: true,
                isReferee: true,
              },
            },
            user2: {
              select: {
                id: true,
                image: true,
                name: true,
                isReferee: true,
              },
            },
            groupTournament: true,
          },
        });
        const rounds = [];
        const referees = (
          await this.prismaService.referees_group_tournaments.findMany({
            where: {
              groupTournamentId: tournament.id,
            },
            include: {
              referee: {
                select: {
                  id: true,
                  image: true,
                  name: true,
                  dob: true,
                  phoneNumber: true,
                },
              },
            },
          })
        ).map((referee) => referee.referee);
        if (referees.length === 0) {
          throw new BadRequestException({
            code: 7005,
            message:
              'Please add referee to tournament before generating fixture',
            data: null,
          });
        }
        if (format === GroupTournamentFormat.round_robin) {
          const tables = this.formatTournamentService.generateTables(
            format,
            1,
            teams.length,
          );
          let k = 1;
          for (let i = 0; i < tables.table1.length; i++) {
            const matches = [];
            for (let j = 0; j < tables.table1[i].length; j++) {
              if (tables.table1[i][j] === tables.table2[i][j]) continue;

              const team1 = {
                user1: teams[tables.table1[i][j] - 1].user1,
                user2: teams[tables.table1[i][j] - 1].user2,
                id: teams[tables.table1[i][j] - 1].id,
              };

              const team2 = {
                user1: teams[tables.table2[i][j] - 1].user1,
                user2: teams[tables.table2[i][j] - 1].user2,
                id: teams[tables.table2[i][j] - 1].id,
              };
              const today = new Date();

              const match = {
                id: randomUUID(),
                nextMatchId: null,
                title: `Match ${k++}`,
                matchStartDate: new Date(today.setDate(today.getDate() + 3)),
                duration: dto.matchDuration,
                status: MatchStatus.scheduled,
                teams: { team1, team2 },
                refereeId: referees[k % referees.length].id,
                venue: dto.venue,
                referee: referees[k % referees.length],
              };
              matches.push(match);
            }
            const round = {
              title: `Round ${i + 1}`,
              matches: matches,
              id: randomUUID(),
            };
            rounds.push(round);
          }
          const group = {
            id: randomUUID(),
            title: 'Round Robin Group',
            isFinal: true,
            rounds: rounds,
          };
          return {
            id: randomUUID(),
            roundRobinGroups: [group],
            status: 'new',
            participantType: 'single',
            format: 'round_robin',
          };
        } else if (format === GroupTournamentFormat.knockout) {
          const tables = this.formatTournamentService.generateTables(
            format,
            1,
            teams.length,
          );

          for (let i = 0; i < tables.table1.length; i++) {
            const rawMatches = [];
            let status = MatchStatus.scheduled.toString();
            for (let j = 0; j < tables.table1[i].length; j++) {
              let id = randomUUID();
              let nextMatchId = randomUUID();
              if (i === 0) {
                if (j % 2 !== 0) {
                  nextMatchId = rawMatches[j - 1].nextMatchId;
                }
              } else if (i === tables.table1.length - 1) {
                id = rounds[i - 1].matches[j * 2].nextMatchId;
                nextMatchId = null;
              } else {
                if (j % 2 !== 0) {
                  nextMatchId = rawMatches[j - 1].nextMatchId;
                }
                id = rounds[i - 1].matches[j * 2].nextMatchId;
              }

              let team1 = null,
                team2 = null;
              if (tables.table1[i][j] !== 0 && tables.table1[i][j] !== -1) {
                team1 = {
                  user1: teams[tables.table1[i][j] - 1].user1,
                  user2: teams[tables.table1[i][j] - 1].user2,
                  id: teams[tables.table1[i][j] - 1].id,
                };
              } else {
                status = MatchStatus.skipped.toString();
              }

              if (tables.table2[i][j] !== 0 && tables.table2[i][j] !== -1) {
                team2 = {
                  user1: teams[tables.table2[i][j] - 1].user1,
                  user2: teams[tables.table2[i][j] - 1].user2,
                  id: teams[tables.table2[i][j] - 1].id,
                };
                status = MatchStatus.scheduled.toString();
              } else {
                status = MatchStatus.skipped.toString();
              }

              if (tables.table1[i][j] === -1 || tables.table2[i][j] === -1) {
                status = MatchStatus.no_show.toString();
              }
              const today = new Date();
              const match = {
                id: id,
                nextMatchId: nextMatchId,
                title: `Match ${j + 1}`,
                matchStartDate: new Date(today.setDate(today.getDate() + 3)),
                duration: dto.matchDuration,
                status: status,
                teams: { team1, team2 },
                refereeId: referees[(j + 1) % referees.length].id,
                venue: dto.venue,
                referee: referees[(j + 1) % referees.length],
              };
              rawMatches.push(match);
            }
            const round = {
              title: `Round ${i + 1}`,
              id: randomUUID(),
              matches: rawMatches,
            };
            rounds.push(round);
          }
          const group = {
            id: randomUUID(),
            title: 'Knockout Group',
            isFinal: true,
            rounds: rounds,
          };
          return {
            id: randomUUID(),
            knockoutGroup: group,
            status: 'new',
            participantType: 'single',
            format: 'knockout',
          };
        }
      }
      //get list of team order by rank

      //generate matches
      if (format === TournamentFormat.group_playoff) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INVALID_FORMAT,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_INVALID_FORMAT,
          ),
          data: null,
        });
      }
    } catch (error) {
      return error;
    }
  }

  async createFixture(id: number, dto: CreateFixtureDto) {
    const format = (
      await this.prismaService.group_tournaments.findFirst({
        where: {
          id: id,
        },
      })
    ).format;

    const numberOfParticipants = await this.prismaService.teams.count({
      where: {
        groupTournamentId: id,
      },
    });
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        id: dto.id,
      },
    });
    const phase =
      dto.status === FixtureStatus.published
        ? TournamentPhase.generated_fixtures
        : undefined;

    if (fixture?.status === FixtureStatus.published) {
      throw new BadRequestException({
        message: 'Fixture is already published',
      });
    }
    await this.prismaService.$transaction(
      async (tx) => {
        await this.fixtureService.removeByGroupTournamentIdIdempontent(id);
        if (dto.status === FixtureStatus.published) {
          await tx.group_tournaments.update({
            where: {
              id: id,
            },
            data: {
              phase: phase,
            },
          });
        }
        const fixture = await tx.fixtures.upsert({
          where: {
            id: dto.id,
          },
          update: {
            numberOfParticipants: numberOfParticipants,
            numberOfGroups: dto.roundRobinGroups?.length ?? 1,
            fixtureStartDate: dto.fixtureStartDate,
            fixtureEndDate: dto.fixtureEndDate,
            matchesStartTime: dto.matchesStartTime,
            matchesEndTime: dto.matchesEndTime,
            matchDuration: dto.matchDuration,
            breakDuration: dto.breakDuration,
            status: dto.status,
            venue: dto.venue,
          },
          create: {
            id: dto.id,
            groupTournamentId: id,
            numberOfParticipants: numberOfParticipants,
            numberOfGroups: dto.roundRobinGroups.length,
            fixtureStartDate: dto.fixtureStartDate,
            fixtureEndDate: dto.fixtureEndDate,
            matchesStartTime: dto.matchesStartTime,
            matchesEndTime: dto.matchesEndTime,
            matchDuration: dto.matchDuration,
            breakDuration: dto.breakDuration,
            status: dto.status,
            venue: dto.venue,
          },
        });

        if (format === GroupTournamentFormat.round_robin) {
          let groupFixtureId = null;
          await Promise.all(
            dto.roundRobinGroups.map(async (group) => {
              const groupFixture = await tx.group_fixtures.upsert({
                where: {
                  id: group.id,
                },
                update: {
                  fixtureId: fixture.id,
                  title: group.title,
                  isFinal: true,
                  numberOfProceeders: group.numberOfProceeders,
                },
                create: {
                  id: group.id,
                  fixtureId: fixture.id,
                  title: group.title,
                  isFinal: true,
                  numberOfProceeders: group.numberOfProceeders,
                },
              });
              groupFixtureId = groupFixture.id;
              await Promise.all(
                group.rounds.map(async (round) => {
                  await tx.rounds.upsert({
                    where: {
                      id: round.id,
                    },
                    update: {
                      groupFixtureId: group.id,
                      title: round.title,
                      elo: 100,
                    },
                    create: {
                      id: round.id,
                      groupFixtureId: group.id,
                      title: round.title,
                      elo: 100,
                    },
                  });
                  //apply elo
                  await Promise.all(
                    round.matches.map(async (match) => {
                      await tx.matches.upsert({
                        where: {
                          id: match.id,
                        },
                        update: {
                          roundId: round.id,
                          title: match.title,
                          status: match.status,
                          rankGroupTeam1: match.rankGroupTeam1,
                          rankGroupTeam2: match.rankGroupTeam2,
                          nextMatchId: match.nextMatchId,
                          matchStartDate: match.matchStartDate,
                          teamId1: match.teams.team1?.id,
                          teamId2: match.teams.team2?.id,
                          venue: match?.venue,
                          duration: match.duration,
                          breakDuration: dto.breakDuration,
                          refereeId: match.refereeId,
                          groupFixtureTeamId1: match.groupFixtureTeamId1,
                          groupFixtureTeamId2: match.groupFixtureTeamId2,
                        },

                        create: {
                          id: match.id,
                          roundId: round.id,
                          title: match.title,
                          status: match.status,
                          rankGroupTeam1: match.rankGroupTeam1,
                          rankGroupTeam2: match.rankGroupTeam2,
                          nextMatchId: match.nextMatchId,
                          matchStartDate: match.matchStartDate,
                          teamId1: match.teams.team1?.id,
                          teamId2: match.teams.team2?.id,
                          venue: match.venue,
                          duration: match.duration,
                          breakDuration: dto.breakDuration,
                          refereeId: match.refereeId,
                          groupFixtureTeamId1: match.groupFixtureTeamId1,
                          groupFixtureTeamId2: match.groupFixtureTeamId2,
                        },
                      });
                    }),
                  );
                }),
              );
            }),
          );
          //update teams
          await tx.teams.updateMany({
            where: {
              groupTournamentId: id,
            },
            data: {
              groupFixtureId: groupFixtureId,
            },
          });
        } else if (format === GroupTournamentFormat.knockout) {
          let groupFixtureId = null;
          const groupFixture = await tx.group_fixtures.upsert({
            where: {
              id: dto.knockoutGroup.id,
            },
            update: {
              fixtureId: fixture.id,
              title: dto.knockoutGroup.title,
              isFinal: true,
              numberOfProceeders: dto.knockoutGroup.numberOfProceeders,
            },
            create: {
              id: dto.knockoutGroup.id,
              fixtureId: fixture.id,
              title: dto.knockoutGroup.title,
              isFinal: true,
              numberOfProceeders: dto.knockoutGroup.numberOfProceeders,
            },
          });
          groupFixtureId = groupFixture.id;
          await Promise.all(
            dto.knockoutGroup.rounds.reverse().map(async (round) => {
              await tx.rounds.upsert({
                where: {
                  id: round.id,
                },
                update: {
                  groupFixtureId: dto.knockoutGroup.id,
                  title: round.title,
                  elo: 100,
                },
                create: {
                  id: round.id,
                  groupFixtureId: dto.knockoutGroup.id,
                  title: round.title,
                  elo: 100,
                },
              });
              //apply elo
              await Promise.all(
                round.matches.map(async (match) => {
                  await tx.matches.upsert({
                    where: {
                      id: match.id,
                    },
                    update: {
                      roundId: round.id,
                      title: match.title,
                      status: match.status,
                      rankGroupTeam1: match.rankGroupTeam1,
                      rankGroupTeam2: match.rankGroupTeam2,
                      nextMatchId: match.nextMatchId,
                      matchStartDate: match.matchStartDate,
                      teamId1: match.teams.team1?.id,
                      teamId2: match.teams.team2?.id,
                      venue: match.venue,
                      duration: match.duration,
                      breakDuration: dto.breakDuration,
                      refereeId: match.refereeId,
                      groupFixtureTeamId1: match.groupFixtureTeamId1,
                      groupFixtureTeamId2: match.groupFixtureTeamId2,
                    },

                    create: {
                      id: match.id,
                      roundId: round.id,
                      title: match.title,
                      status: match.status,
                      rankGroupTeam1: match.rankGroupTeam1,
                      rankGroupTeam2: match.rankGroupTeam2,
                      nextMatchId: match.nextMatchId,
                      matchStartDate: match.matchStartDate,
                      teamId1: match.teams.team1?.id,
                      teamId2: match.teams.team2?.id,
                      venue: match.venue,
                      duration: match.duration,
                      breakDuration: dto.breakDuration,
                      refereeId: match.refereeId,
                      groupFixtureTeamId1: match.groupFixtureTeamId1,
                      groupFixtureTeamId2: match.groupFixtureTeamId2,
                    },
                  });
                }),
              );
            }),
          );
          //update teams
          await tx.teams.updateMany({
            where: {
              groupTournamentId: id,
            },
            data: {
              groupFixtureId: groupFixtureId,
            },
          });
        } else if (format === TournamentFormat.group_playoff) {
          throw new BadRequestException({
            code: CustomResponseStatusCodes.TOURNAMENT_INVALID_FORMAT,
            message: CustomResponseMessages.getMessage(
              CustomResponseStatusCodes.TOURNAMENT_INVALID_FORMAT,
            ),
            data: null,
          });
        }
      },
      {
        maxWait: 10000, // default: 2000
        timeout: 10000, // default: 5000
      },
    );

    //return response
    const { groupFixtures, ...others } =
      await this.prismaService.fixtures.findFirst({
        where: {
          id: dto.id,
        },
        include: {
          groupFixtures: {
            where: {
              isFinal: true,
            },
            include: {
              rounds: {
                orderBy: {
                  title: 'asc',
                },
                include: {
                  matches: {
                    orderBy: {
                      title: 'asc',
                    },
                    include: {
                      groupFixture1: true,
                      groupFixture2: true,
                      team1: {
                        include: {
                          user1: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                              isReferee: true,
                            },
                          },
                          user2: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                              isReferee: true,
                            },
                          },
                        },
                      },
                      team2: {
                        include: {
                          user1: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                              isReferee: true,
                            },
                          },
                          user2: {
                            select: {
                              id: true,
                              image: true,
                              name: true,
                              isReferee: true,
                            },
                          },
                        },
                      },
                      referee: {
                        select: {
                          id: true,
                          image: true,
                          name: true,
                          dob: true,
                          phoneNumber: true,
                          isReferee: true,
                        },
                      },
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
                    },
                  },
                },
              },
            },
          },
        },
      });
    const groups = groupFixtures.map((groupFixture) => {
      const rounds = groupFixture.rounds.map((round) => {
        const matches = round.matches.map((match) => {
          const { team1, team2, groupFixture1, groupFixture2, ...others } =
            match;
          let team1R = null,
            team2R = null;
          if (
            team1 === null &&
            !match.rankGroupTeam1 != null &&
            groupFixture1 != null
          ) {
            team1R = {
              user1: null,
              user2: null,
              name: `Winner ${match.rankGroupTeam1} of ${groupFixture1.title}`,
            };
          }
          if (
            team2 === null &&
            match.rankGroupTeam2 != null &&
            groupFixture2 != null
          ) {
            team2R = {
              user1: null,
              user2: null,
              name: `Winner ${match.rankGroupTeam2} of ${groupFixture2.title}`,
            };
          }
          return {
            ...others,
            teams: { team1: team1 || team1R, team2: team2 || team2R },
          };
        });
        return { ...round, matches: matches };
      });
      return { ...groupFixture, rounds: rounds };
    });
    if (format === GroupTournamentFormat.round_robin) {
      return { ...others, roundRobinGroups: groups, format };
    } else if (format === GroupTournamentFormat.knockout) {
      //groups[0].rounds.reverse();
      return { ...others, knockoutGroup: groups[0], format };
    } else if (format === TournamentFormat.group_playoff) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVALID_FORMAT,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVALID_FORMAT,
        ),
        data: null,
      });
    }
  }

  async getAllTeams(
    tournamentId: number,
    pageOptions: PageOptionsGroupTournamentDto,
  ) {
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupTournamentId: tournamentId,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.teams.findMany({
        ...conditions,
        ...pageOption,
        include: {
          user1: {
            select: {
              id: true,
              image: true,
              name: true,
              isReferee: true,
            },
          },
          user2: {
            select: {
              id: true,
              image: true,
              name: true,
              isReferee: true,
            },
          },
        },
      }),
      this.prismaService.teams.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async finalizeApplicantList(
    tournamentId: number,
    userId: string,
    groupId: number,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    const group = await this.checkValidGroup(groupId);

    // Check expiration date of the purchased package
    if (new Date(group.purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the user is the creator of the tournament
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
        data: null,
      });
    }

    // Check if the tournament status is already finalized_applicants
    if (tournament.phase === GroupTournamentPhase.finalized_applicants) {
      return {
        code: CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_ALREADY_FINALIZED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_ALREADY_FINALIZED,
        ),
        data: null,
      };
    }

    // Update tournament
    // phase -> finalized_applicants
    // status -> on_going
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          await tx.group_tournaments.update({
            where: {
              id: tournamentId,
            },
            data: {
              phase: GroupTournamentPhase.finalized_applicants,
              status: GroupTournamentStatus.on_going,
            },
          });
          const applicants = await tx.group_tournament_registrations.findMany({
            where: {
              groupTournamentId: tournamentId,
            },
          });
          if (applicants.length < 5) {
            throw new BadRequestException({
              code: CustomResponseStatusCodes.TOURNAMENT_INVALID_NUMBER_APPLICANT,
              message: CustomResponseMessages.getMessage(
                CustomResponseStatusCodes.TOURNAMENT_INVALID_NUMBER_APPLICANT,
              ),
            });
          }
          const teams = await Promise.all(
            applicants.map(async (applicant) => {
              const { groupTournamentId, userId } = applicant;

              const user = await tx.users.findFirst({
                where: {
                  id: userId,
                },
              });

              const totalElo = user?.elo ?? 0;
              return {
                name: user.name,
                userId1: userId,
                totalElo,
                groupTournamentId,
              };
            }),
          );
          return await tx.teams.createMany({
            data: teams,
          });
        },
        {
          maxWait: 10000, // default: 2000
          timeout: 10000, // default: 5000
        },
      );
    } catch (error) {
      console.log('Error:', error.message);
      throw error;
    }
  }

  async getByGroupTournamentId(
    tournamentId: number,
    userId: string,
    groupId: number,
  ) {
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    const group = await this.checkValidGroup(groupId);

    // Check expiration date of the purchased package
    if (new Date(group.purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        groupTournamentId: tournamentId,
      },
      include: {
        groupFixtures: {
          where: {
            isFinal: true,
          },
          include: {
            rounds: {
              orderBy: {
                title: 'asc',
              },
              include: {
                matches: {
                  orderBy: {
                    title: 'asc',
                  },
                  include: {
                    groupFixture1: true,
                    groupFixture2: true,
                    team1: {
                      include: {
                        user1: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                        user2: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                      },
                    },
                    team2: {
                      include: {
                        user1: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                        user2: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                      },
                    },
                    referee: {
                      select: {
                        id: true,
                        image: true,
                        name: true,
                        dob: true,
                        phoneNumber: true,
                      },
                    },
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
                  },
                },
              },
            },
          },
        },
        tournament: true,
      },
    });

    // Check if the user is the creator of the tournament
    const isCreator = group.purchasedPackage.userId === userId;
    if (isCreator) {
      if (tournament.phase === TournamentPhase.new) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          message: CustomResponseMessages.getMessage(
            CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
          ),
          data: null,
        });
      }
      if (!fixture) {
        return {
          status: 'new',
        };
      }
    } else if (
      tournament.phase === TournamentPhase.new ||
      tournament.phase === TournamentPhase.finalized_applicants
    ) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INVALID_PHASE,
        ),
        data: null,
      });
    }
    if (!fixture) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.FIXTURE_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.FIXTURE_NOT_FOUND,
        ),
        data: null,
      });
    }
    const { groupFixtures, ...others } = fixture;
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
    const groups = groupFixtures.map((groupFixture) => {
      const rounds = groupFixture.rounds.map((round) => {
        const matches = round.matches.map((match) => {
          const { team1, team2, groupFixture1, groupFixture2, ...others } =
            match;
          let team1R = null,
            team2R = null;
          if (
            team1 === null &&
            !match.rankGroupTeam1 != null &&
            groupFixture1 != null
          ) {
            team1R = {
              user1: null,
              user2: null,
              name: `Winner ${match.rankGroupTeam1} of ${groupFixture1.title}`,
            };
          }
          if (
            team2 === null &&
            match.rankGroupTeam2 != null &&
            groupFixture2 != null
          ) {
            team2R = {
              user1: null,
              user2: null,
              name: `Winner ${match.rankGroupTeam2} of ${groupFixture2.title}`,
            };
          }
          return {
            ...others,
            isFollowed: followMatches.includes(others.id),
            teams: { team1: team1 || team1R, team2: team2 || team2R },
          };
        });
        return { ...round, matches: matches };
      });
      return { ...groupFixture, rounds: rounds };
    });
    if (tournament.format === TournamentFormat.round_robin) {
      return {
        ...others,
        roundRobinGroups: groups,
        format: tournament.format,
        isFollowed: followMatches.includes(others.id),
      };
    } else if (tournament.format === TournamentFormat.knockout) {
      //groups[0].rounds.reverse();
      return {
        ...others,
        knockoutGroup: groups[0],
        format: tournament.format,
        isFollowed: followMatches.includes(others.id),
      };
    } else if (tournament.format === TournamentFormat.group_playoff) {
      //groups[0].rounds.reverse();
      const knockoutGroup = groups[0];
      const fixtureGroups = [];
      const roundRobinGroups = (
        await this.prismaService.group_fixtures.findMany({
          where: {
            isFinal: false,
            fixtureId: others.id,
          },
          include: {
            rounds: {
              orderBy: {
                title: 'asc',
              },
              include: {
                matches: {
                  orderBy: {
                    title: 'asc',
                  },
                  include: {
                    team1: {
                      include: {
                        user1: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                        user2: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                      },
                    },
                    team2: {
                      include: {
                        user1: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                        user2: {
                          select: {
                            id: true,
                            image: true,
                            name: true,
                          },
                        },
                      },
                    },
                    referee: {
                      select: {
                        id: true,
                        image: true,
                        name: true,
                        dob: true,
                        phoneNumber: true,
                      },
                    },
                  },
                },
              },
            },
            teams: {
              include: {
                user1: {
                  select: {
                    id: true,
                    image: true,
                    name: true,
                  },
                },
                user2: {
                  select: {
                    id: true,
                    image: true,
                    name: true,
                  },
                },
              },
            },
          },
        })
      ).map((groupFixture) => {
        const { id, title, numberOfProceeders, teams } = groupFixture;
        fixtureGroups.push({
          id,
          title,
          numberOfProceeders,
          teams,
        });
        const rounds = groupFixture.rounds.map((round) => {
          const matches = round.matches.map((match) => {
            const { team1, team2, ...others } = match;
            return {
              ...others,
              teams: { team1, team2 },
              isFollowed: followMatches.includes(others.id),
            };
          });
          return { ...round, matches: matches };
        });
        return { ...groupFixture, rounds: rounds };
      });
      return {
        ...others,
        format: tournament.format,
        knockoutGroup,
        roundRobinGroups,
        groups: fixtureGroups,
      };
    }
  }

  async removeByGroupTournamentId(tournamentId: number) {
    const fixture = await this.prismaService.fixtures.findFirst({
      where: {
        groupTournamentId: tournamentId,
      },
      select: {
        groupFixtures: true,
      },
    });
    if (!fixture) {
      throw new NotFoundException({
        message: 'Fixture not found',
      });
    }
    for (const groupFixture of fixture.groupFixtures) {
      await this.prismaService.teams.updateMany({
        where: {
          groupFixtureId: groupFixture.id,
        },
        data: {
          groupFixtureId: null,
        },
      });
    }

    await this.prismaService.fixtures.deleteMany({
      where: {
        groupTournamentId: tournamentId,
      },
    });
    return { message: 'success' };
  }

  async getTournamentParticipants(
    tournamentId: number,
    pageOptions: PageOptionsTournamentRegistrationDto,
    groupId: number,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    const group = await this.checkValidGroup(groupId);

    // Check expiration date of the purchased package
    if (new Date(group.purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        code: CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.PURCHASED_PACKAGE_IS_EXPIRED,
        ),
        data: null,
      });
    }

    // Check if the tournament status is finalized_applicants
    if (tournament.phase === TournamentPhase.new) {
      return {
        code: CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_NOT_FINALIZED,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_APPLICANT_LIST_NOT_FINALIZED,
        ),
        data: null,
      };
    }

    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        tournamentId: tournamentId,
        status: RegistrationStatus.approved, // Only approved participants
      },
    };

    conditions['select'] = {
      user1: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          elo: true,
          isReferee: true,
        },
      },
      message: true,
      status: true,
      appliedDate: true,
      seed: true,
    };

    // if (tournament.participantType === ParticipantType.single) {
    //   conditions['select'] = {
    //     user1: {
    //       select: {
    //         id: true,
    //         name: true,
    //         email: true,
    //         image: true,
    //         elo: true,
    //         isReferee: true,
    //       },
    //     },
    //     message: true,
    //     status: true,
    //     appliedDate: true,
    //     seed: true,
    //   };
    // } else {
    //   conditions['select'] = {
    //     user1: {
    //       select: {
    //         id: true,
    //         name: true,
    //         email: true,
    //         image: true,
    //         elo: true,
    //         isReferee: true,
    //       },
    //     },
    //     user2: {
    //       select: {
    //         id: true,
    //         name: true,
    //         email: true,
    //         image: true,
    //         elo: true,
    //         isReferee: true,
    //       },
    //     },
    //     message: true,
    //     status: true,
    //     appliedDate: true,
    //     seed: true,
    //   };
    // }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get finalized applicants
    const [result, totalCount] = await Promise.all([
      this.prismaService.tournament_registrations.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.tournament_registrations.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    return {
      data: result,
      participantType: 'single',
      maxParticipants: group.maxMembers,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async updateTournamentInfo(
    userId: string,
    tournamentId: number,
    groupId: number,
    updateDto: UpdateGroupTournamentDto,
  ) {
    // Get tournament info
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    // Get purchased package info
    const group = await this.checkValidGroup(groupId);

    // Check if the user is the owner of this tournament
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        code: CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_UNAUTHORIZED_ACCESS,
        ),
        data: null,
      });
    }

    // Update some fields based on the phase
    if (tournament.phase === GroupTournamentPhase.new) {
    } else if (tournament.phase === GroupTournamentPhase.published) {
      // published
      if (updateDto.format) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
          message: `The tournament phase is ${tournament.phase}. Invalid update data`,
        });
      }
    } else {
      // finalized_applicants -> completed
      if (
        updateDto.startDate ||
        updateDto.endDate ||
        updateDto.format ||
        updateDto.maxParticipants
      ) {
        throw new BadRequestException({
          code: CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
          message: `The tournament phase is ${tournament.phase}. Invalid update data`,
        });
      }
    }

    // Update tournament info
    try {
      const updatedTournament =
        await this.prismaService.group_tournaments.update({
          where: {
            id: tournamentId,
          },
          data: {
            ...updateDto,
          },
        });

      return updatedTournament;
    } catch (err) {
      console.log('Error:', err.message);
      throw new InternalServerErrorException({
        code: CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_INFO_UPDATE_FAIL,
        ),
        data: null,
      });
    }
  }
  // Utils
  async getTournamentParticipantsCount(tournamentId: number): Promise<number> {
    const participantCountUser1 =
      await this.prismaService.group_tournament_registrations.count({
        where: {
          groupTournamentId: tournamentId,
        },
      });

    const participantCount = participantCountUser1;
    return participantCount;
  }

  //Referee
  async addReferee(
    userId: string,
    createRefereesTournamentDto: AddParticipantsDto,
    groupId: number,
    tournamentId: number,
  ) {
    const tournament = await this.prismaService.group_tournaments.findUnique({
      where: {
        id: tournamentId,
      },
    });

    if (!tournament) {
      throw new NotFoundException({
        code: CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        message: CustomResponseMessages.getMessage(
          CustomResponseStatusCodes.TOURNAMENT_NOT_FOUND,
        ),
        data: null,
      });
    }

    // if (tournament.phase != GroupTournamentPhase.finalized_applicants) {
    //   throw new BadRequestException({
    //     code: 400,
    //     message: 'Tournament phase must be finalized_applicants',
    //   });
    // }

    const group = await this.checkValidGroup(groupId);

    // Check if the user is the creator of the tournament
    const isCreator = group.purchasedPackage.userId === userId;
    if (!isCreator) {
      throw new ForbiddenException({
        message: 'You are not a creator of this group',
        data: null,
      });
    }
    const members = await this.prismaService.member_ships.findMany({
      where: {
        groupId,
        userId: {
          in: createRefereesTournamentDto.userIds,
        },
      },
    });

    if (members.length !== createRefereesTournamentDto.userIds.length) {
      throw new NotFoundException({
        message: 'Some users are not members of this group',
        data: null,
      });
    }

    const referees =
      await this.prismaService.referees_group_tournaments.findMany({
        where: {
          groupTournamentId: tournamentId,
          refereeId: {
            in: createRefereesTournamentDto.userIds,
          },
        },
      });

    if (referees.length > 0) {
      throw new BadRequestException({
        message: 'Some users already have referee role',
        data: null,
      });
    }

    // Check if the user ids are already participants of the tournament
    const participants =
      await this.prismaService.group_tournament_registrations.findMany({
        where: {
          groupTournamentId: tournamentId,
          userId: {
            in: createRefereesTournamentDto.userIds,
          },
        },
      });

    if (participants.length > 0) {
      throw new ConflictException({
        message: 'Some users are already participants of this tournament',
        data: null,
      });
    }
    for (const referee of createRefereesTournamentDto.userIds) {
      await this.prismaService.referees_group_tournaments.create({
        data: {
          refereeId: referee,
          groupTournamentId: tournamentId,
        },
      });

      await this.prismaService.users.update({
        where: {
          id: referee,
        },
        data: {
          isReferee: true,
        },
      });
    }
    const pageOptionsRefereesTournamentsDto: PageOptionsRefereesGroupTournamentsDto =
      new PageOptionsRefereesGroupTournamentsDto();
    return await this.listReferees(
      pageOptionsRefereesTournamentsDto,
      tournamentId,
    );
  }

  async listReferees(
    pageOptionsRefereesTournamentsDto: PageOptionsRefereesGroupTournamentsDto,
    tournamentId: number,
  ) {
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsRefereesTournamentsDto.order,
        },
      ],
      where: {
        groupTournamentId: tournamentId,
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
      this.prismaService.referees_group_tournaments.findMany({
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
      this.prismaService.referees_group_tournaments.count({ ...conditions }),
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

  // Group funds
  async createGroupFund(
    groupId: number,
    userId: string,
    dto: CreateGroupFundDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Remove fields in dto
    const isFullMember = dto.isFullMember;
    const memberListId = dto.memberListId;
    delete dto.isFullMember;
    delete dto.memberListId;

    // Create group fund
    try {
      const groupFund = await this.prismaService.group_funds.create({
        data: {
          ...dto,
          groupId,
        },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          amount: true,
          paymentInfo: true,
          qrImage: true,
          createdAt: true,
        },
      });

      let conditions = {};
      if (!isFullMember) {
        // Create group fund requests in memberListId
        conditions = {
          userId: {
            in: memberListId,
          },
        };
      }

      const members = await this.prismaService.member_ships.findMany({
        where: {
          groupId: groupId,
          role: MemberRole.member,
          ...conditions,
        },
      });

      for (const member of members) {
        await this.prismaService.user_group_funds.create({
          data: {
            groupFundId: groupFund.id,
            userId: member.userId,
            amount: groupFund.amount,
          },
        });
      }

      // TODO: Notify to all group member about the new group fund

      return groupFund;
    } catch (error) {
      throw error;
    }
  }

  async fetchGroupFunds(
    groupId: number,
    userId: string,
    pageOptions: PageOptionsGroupFundDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Fetch group funds
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupId: groupId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        amount: true,
        paymentInfo: true,
        qrImage: true,
        createdAt: true,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.group_funds.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.group_funds.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    return {
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
      data: result,
    };
  }

  async fetchUserFundRequests(
    groupId: number,
    userId: string,
    pageOptions: PageOptionsGroupFundDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is in the group
    const member = await this.prismaService.member_ships.findFirst({
      where: {
        groupId: group.id,
        userId: userId,
      },
    });

    if (!member) {
      throw new UnauthorizedException({
        message: 'User is not a member of the group',
        data: null,
      });
    }

    if (member.role === MemberRole.group_admin) {
      throw new BadRequestException('Group admin do not have fund requests');
    }

    // Get all group fund of the group
    const group_funds = await this.prismaService.group_funds.findMany({
      where: {
        groupId: groupId,
      },
    });

    const group_funds_ids = group_funds.map((group_fund) => group_fund.id);

    // Get user's group fund requests
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupFundId: {
          in: group_funds_ids,
        },
        userId: userId,
      },
      select: {
        id: true,
        groupFundId: true,
        status: true,
        amount: true,
        createdAt: true,
        groupFund: {
          select: {
            title: true,
            description: true,
            dueDate: true,
            paymentInfo: true,
            qrImage: true,
          },
        },
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.user_group_funds.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.user_group_funds.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    // Update response data
    result.map((userFundReq) => {
      // Move data out of groupFund
      userFundReq['title'] = userFundReq.groupFund.title;
      userFundReq['description'] = userFundReq.groupFund.description;
      userFundReq['dueDate'] = userFundReq.groupFund.dueDate;
      userFundReq['paymentInfo'] = userFundReq.groupFund.paymentInfo;
      userFundReq['qrImage'] = userFundReq.groupFund.qrImage;
      delete userFundReq.groupFund;
    });

    return {
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
      data: result,
    };
  }

  async fetchGroupFundUserRequests(
    groupId: number,
    fundId: number,
    userId: string,
    pageOptions: PageOptionsGroupFundDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Get group_fund's info
    const group_fund = await this.prismaService.group_funds.findUnique({
      where: {
        id: fundId,
      },
    });

    if (!group_fund) {
      throw new BadRequestException({
        message: 'Group fund not found',
        data: null,
      });
    }

    // Get user's group fund requests
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupFundId: fundId,
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
        description: true,
        status: true,
        amount: true,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.user_group_funds.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.user_group_funds.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    // Update response data
    result.map((userFundReq) => {
      userFundReq['name'] = userFundReq.user.name;
      userFundReq['image'] = userFundReq.user.image;
      delete userFundReq.user;
    });

    return {
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
      data: result,
    };
  }

  async fetchGroupNonFundingUsersOfAFund(
    groupId: number,
    fundId: number,
    userId: string,
    pageOptions: PageOptionsGroupFundDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Get group_fund's info
    const groupFund = await this.prismaService.group_funds.findUnique({
      where: {
        id: fundId,
      },
    });

    if (!groupFund) {
      throw new BadRequestException({
        message: 'Group fund not found',
        data: null,
      });
    }

    // Get group fund's users
    const groupFundUsers = await this.prismaService.user_group_funds.findMany({
      where: {
        groupFundId: fundId,
      },
      select: {
        userId: true,
      },
    });

    // Put userIds into a list of strings
    const groupFundUserIds = groupFundUsers.map((userFund) => userFund.userId);

    // Get group fund's non funding users
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupId: groupId,
        userId: {
          notIn: groupFundUserIds,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
            image: true,
            gender: true,
          },
        },
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.member_ships.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.member_ships.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    // Update response data
    result.map((nonFundingUser) => {
      nonFundingUser['email'] = nonFundingUser.user.email;
      nonFundingUser['name'] = nonFundingUser.user.name;
      nonFundingUser['image'] = nonFundingUser.user.image;
      nonFundingUser['gender'] = nonFundingUser.user.gender;
      delete nonFundingUser.user;
    });

    return {
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
      data: result,
    };
  }

  async createUserFundRequest(
    groupId: number,
    userId: string,
    dto: CreateUserFundRequestDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Get group_fund's info
    const groupFund = await this.prismaService.group_funds.findUnique({
      where: {
        id: dto.fundId,
      },
    });

    if (!groupFund) {
      throw new BadRequestException({
        message: 'Group fund not found',
        data: null,
      });
    }

    // Create user's fund request
    try {
      const fundRequest = await this.prismaService.user_group_funds.create({
        data: {
          groupFundId: groupFund.id,
          userId: dto.userId,
          amount: dto.amount,
        },
        select: {
          id: true,
          groupFundId: true,
          amount: true,
          status: true,
          createdAt: true,
          groupFund: {
            select: {
              title: true,
              description: true,
              dueDate: true,
              paymentInfo: true,
              qrImage: true,
            },
          },
        },
      });

      // Update response data
      fundRequest['title'] = fundRequest.groupFund.title;
      fundRequest['description'] = fundRequest.groupFund.description;
      fundRequest['dueDate'] = fundRequest.groupFund.dueDate;
      fundRequest['paymentInfo'] = fundRequest.groupFund.paymentInfo;
      fundRequest['qrImage'] = fundRequest.groupFund.qrImage;
      delete fundRequest.groupFund;

      return fundRequest;
    } catch (error) {
      throw error;
    }
  }

  async userConfirmFundRequest(
    groupId: number,
    fundId: number,
    userId: string,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is a member of the group
    const member = await this.prismaService.member_ships.findFirst({
      where: {
        groupId: group.id,
        userId: userId,
      },
    });

    if (!member) {
      throw new UnauthorizedException({
        message: 'User is not a member of the group',
        data: null,
      });
    }

    // Get group_fund's info
    const groupFund = await this.prismaService.group_funds.findUnique({
      where: {
        id: fundId,
      },
    });

    if (!groupFund) {
      throw new BadRequestException({
        message: 'Group fund not found',
        data: null,
      });
    }

    // Get user's group fund request
    const userGroupFund = await this.prismaService.user_group_funds.findFirst({
      where: {
        groupFundId: fundId,
        userId: userId,
      },
    });

    if (!userGroupFund) {
      throw new BadRequestException({
        message: 'User fund request not found',
        data: null,
      });
    }

    // Check fund request status
    if (userGroupFund.status !== GroupFundStatus.waiting) {
      throw new BadRequestException(
        `Invalid fund request status, status: '${userGroupFund.status}'`,
      );
    }

    // Confirm user's fund request
    try {
      const userFundReq = await this.prismaService.user_group_funds.update({
        where: {
          id: userGroupFund.id,
        },
        data: {
          status: GroupFundStatus.pending,
        },
        select: {
          id: true,
          status: true,
          amount: true,
          createdAt: true,
          groupFund: {
            select: {
              title: true,
              description: true,
              dueDate: true,
              paymentInfo: true,
              qrImage: true,
            },
          },
        },
      });

      // Update response data
      // Move data out of groupFund
      userFundReq['title'] = userFundReq.groupFund.title;
      userFundReq['description'] = userFundReq.groupFund.description;
      userFundReq['dueDate'] = userFundReq.groupFund.dueDate;
      userFundReq['paymentInfo'] = userFundReq.groupFund.paymentInfo;
      userFundReq['qrImage'] = userFundReq.groupFund.qrImage;
      delete userFundReq.groupFund;

      return userFundReq;
    } catch (error) {
      throw error;
    }
  }

  async adminConfirmGroupFundRequest(
    groupId: number,
    fundId: number,
    userId: string,
    dto: ConfirmGroupFundRequestDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Get group_fund's info
    const groupFund = await this.prismaService.group_funds.findUnique({
      where: {
        id: fundId,
      },
    });

    if (!groupFund) {
      throw new BadRequestException({
        message: 'Group fund not found',
        data: null,
      });
    }

    // Get user's group fund request
    const userFund = await this.prismaService.user_group_funds.findFirst({
      where: {
        groupFundId: fundId,
        userId: dto.userId,
      },
    });

    if (!userFund) {
      throw new BadRequestException({
        message: 'User fund request not found',
        data: null,
      });
    }

    if (
      userFund.status !== GroupFundStatus.pending &&
      userFund.status !== GroupFundStatus.rejected
    ) {
      throw new BadRequestException(
        `Invalid fund request status, status: '${userFund.status}'`,
      );
    }

    // Confirm user's fund request
    try {
      const userFundReq = await this.prismaService.user_group_funds.update({
        where: {
          id: userFund.id,
        },
        data: {
          status: dto.status,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          amount: true,
          createdAt: true,
          groupFund: {
            select: {
              title: true,
              description: true,
              dueDate: true,
              paymentInfo: true,
              qrImage: true,
            },
          },
        },
      });

      if (dto.status === GroupFundStatus.accepted) {
        // Create group expense - type: income
        await this.prismaService.group_expenses.create({
          data: {
            groupId: groupId,
            type: ExpenseType.income,
            description: `Income from group fund - id: ${groupFund.id}, title: ${groupFund.title}, member: ${userId}`,
            amount: groupFund.amount,
          },
        });
      }

      // Update response data
      // Move data out of groupFund
      userFundReq['title'] = userFundReq.groupFund.title;
      userFundReq['description'] = userFundReq.groupFund.description;
      userFundReq['dueDate'] = userFundReq.groupFund.dueDate;
      userFundReq['paymentInfo'] = userFundReq.groupFund.paymentInfo;
      userFundReq['qrImage'] = userFundReq.groupFund.qrImage;
      delete userFundReq.groupFund;

      return userFundReq;
    } catch (error) {
      throw error;
    }
  }

  // Group expenses
  async createGroupExpense(
    groupId: number,
    userId: string,
    dto: CreateGroupExpenseDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the group admin
    if (group.purchasedPackage.userId !== userId) {
      throw new UnauthorizedException({
        message: 'Only the group admin can perform this action',
        data: null,
      });
    }

    // Convert categories to JSON string
    const category_data_json_str = JSON.stringify({
      categories: dto.categories,
    });

    // Create group expense
    try {
      const group_expense = await this.prismaService.group_expenses.create({
        data: {
          groupId: groupId,
          type: dto.type,
          description: dto.description,
          amount: dto.amount,
          categories: category_data_json_str,
        },
        select: {
          id: true,
          type: true,
          categories: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      });

      // Update response data
      // Parse categories to JSON
      group_expense.categories = JSON.parse(
        group_expense.categories,
      ).categories;

      return group_expense;
    } catch (error) {
      throw error;
    }
  }

  async fetchGroupExpenses(
    groupId: number,
    userId: string,
    pageOptions: PageOptionsGroupExpenseDto,
  ) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the member of the group
    const member = await this.prismaService.member_ships.findFirst({
      where: {
        groupId: group.id,
        userId: userId,
      },
    });

    if (!member) {
      throw new UnauthorizedException({
        message: 'Only member of the group can perform this action',
        data: null,
      });
    }

    // Fetch group expenses
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        groupId: groupId,
        type: ExpenseType.expense,
      },
      select: {
        id: true,
        type: true,
        categories: true,
        amount: true,
        description: true,
        createdAt: true,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.group_expenses.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.group_expenses.count({
        where: {
          ...conditions.where,
        },
      }),
    ]);

    // Update response data
    result.map((expense) => {
      // Parse categories to JSON
      expense.categories = JSON.parse(expense.categories).categories;
    });

    return {
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
      data: result,
    };
  }

  async fetchGroupFundBalance(groupId: number, userId: string) {
    // Check and get group's info
    const group = await this.checkValidGroup(groupId);

    // Check if req user is the member of the group
    const member = await this.prismaService.member_ships.findFirst({
      where: {
        groupId: group.id,
        userId: userId,
      },
    });

    if (!member) {
      throw new UnauthorizedException({
        message: 'Only member of the group can perform this action',
        data: null,
      });
    }

    // Get group expenses
    const groupExpenses = await this.prismaService.group_expenses.findMany({
      where: {
        groupId: groupId,
      },
      select: {
        amount: true,
        type: true,
      },
    });

    // Calculate balance
    let fundBalance = 0;

    // Calculate balance = sum(income) - sum(expense)
    groupExpenses.forEach((expense) => {
      if (expense.type === ExpenseType.income) {
        fundBalance += expense.amount;
      } else {
        fundBalance -= expense.amount;
      }
    });

    // Get latest group fund (Fund payment)
    const latest_group_fund = await this.prismaService.group_funds.findFirst({
      where: {
        groupId: groupId,
      },
      orderBy: {
        id: 'desc',
      },
    });

    if (!latest_group_fund) {
      return {
        balance: fundBalance,
        currentFund: null,
      };
    }

    // Get current amount of the latest group fund
    const numOfMemberCompletedFundReq =
      await this.prismaService.user_group_funds.count({
        where: {
          groupFundId: latest_group_fund.id,
          status: GroupFundStatus.accepted,
        },
      });

    const currentAmount =
      numOfMemberCompletedFundReq * latest_group_fund.amount;

    // Get target amount of the latest group fund
    const numOfMemberFundReq = await this.prismaService.user_group_funds.count({
      where: {
        groupFundId: latest_group_fund.id,
      },
    });

    const targetAmount = numOfMemberFundReq * latest_group_fund.amount;

    return {
      balance: fundBalance,
      currentFund: {
        id: latest_group_fund.id,
        title: latest_group_fund.title,
        currentAmount: currentAmount,
        targetAmount: targetAmount,
      },
    };
  }
}
