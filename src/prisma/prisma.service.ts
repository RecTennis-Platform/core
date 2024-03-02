import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          // Database connection string
          url: process.env.POSTGRES_DATABASE_URL,
        },
      },
    });
  }
}
