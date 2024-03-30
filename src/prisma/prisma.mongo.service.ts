import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@internal/prisma_mongo/client';

@Injectable()
export class MongoDBPrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.MONGODB_URL,
        },
      },
    });
  }
}
