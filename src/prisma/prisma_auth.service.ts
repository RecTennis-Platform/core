import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@internal/prisma_auth/client';

@Injectable()
export class AuthPrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.AUTH_DATABASE_URL,
        },
      },
    });
  }
}
