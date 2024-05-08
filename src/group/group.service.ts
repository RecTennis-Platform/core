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
import { GroupStatus, GroupTournamentPhase, MemberRole } from '@prisma/client';
import { ITokenPayload } from 'src/auth_utils/interfaces';
import { MembershipService } from 'src/membership/membership.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMailTemplateDto } from 'src/services/mail/mail.dto';
import { MailService } from 'src/services/mail/mail.service';

import { deleteFilesFromFirebase } from 'src/services/files/delete';
import {
  EUploadFolder,
  uploadFilesFromFirebase,
} from 'src/services/files/upload';
import {
  CreateGroupDto,
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

@Injectable()
export class GroupService {
  constructor(
    private readonly mailService: MailService,
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
    private membershipService: MembershipService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
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

    await this.checkPurchasePackage(group.purchasedPackageId);

    return group;
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
  async create(
    adminId: string,
    dto: CreateGroupDto,
    image: Express.Multer.File,
  ) {
    if (!image) {
      throw new BadRequestException({
        message: 'Image is required',
        statusCode: '400',
        error: 'Bad Request',
      });
    }

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

    let imageUrls = [];

    try {
      const uploadImagesData = await uploadFilesFromFirebase(
        [image],
        EUploadFolder.group,
      );

      if (!uploadImagesData.success) {
        throw new Error('Failed to upload images!');
      }

      imageUrls = uploadImagesData.urls;

      const data = await this.prismaService.groups.create({
        data: {
          image: imageUrls[0],
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
      if (!imageUrls.length) await deleteFilesFromFirebase(imageUrls);

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
        email: null,
        groupId: dto.groupId,
        sub: null,
      });
      return {
        link: `${process.env.INVITE_USER_TO_GROUP_LINK}?token=${token.token}`,
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

  // async createPost(userId: string, groupId: number) {
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
    await this.checkValidGroup(groupId);

    await this.checkMember(userId, groupId, true);

    try {
      const data = await this.prismaService.group_tournaments.create({
        data: {
          groupId,
          ...dto,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
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
        },
        ...conditions,
      });
    }

    return result;
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

    const nonParticipants = await this.prismaService.member_ships.findMany({
      where: {
        groupId,
        NOT: {
          userId: {
            in: participants.map((participant) => participant.userId),
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
}
