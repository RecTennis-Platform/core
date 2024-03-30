import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MongoDBPrismaService } from './prisma.mongo.service';

@Global()
@Module({
  providers: [PrismaService, MongoDBPrismaService],
  exports: [PrismaService, MongoDBPrismaService],
})
export class PrismaModule {}
