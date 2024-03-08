import { Global, Module } from '@nestjs/common';
import { CorePrismaService } from './prisma_core.service';
import { AuthPrismaService } from './prisma_auth.service';

@Global()
@Module({
  providers: [CorePrismaService, AuthPrismaService],
  exports: [CorePrismaService, AuthPrismaService],
})
export class PrismaModule {}
