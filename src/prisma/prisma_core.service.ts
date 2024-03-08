import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class CorePrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.CORE_DATABASE_URL,
        },
      },
    });
  }
}
