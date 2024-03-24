import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { NewsModule } from './news/news.module';
import { UserModule } from './user/user.module';
import { MobileMiniAppModule } from './mobile_mini_app/mobile_mini_app.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { GroupModule } from './group/group.module';
import { OrderModule } from './order/order.module';
import { MembershipModule } from './membership/membership.module';

@Module({
  imports: [
    PrismaModule,
    NewsModule,
    UserModule,
    AffiliateModule,
    MobileMiniAppModule,
    GroupModule,
    OrderModule,
    MembershipModule,
  ],
})
export class AppModule {}
