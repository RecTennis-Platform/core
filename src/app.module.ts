import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { NewsModule } from './news/news.module';
import { UserModule } from './user/user.module';
import { MobileMiniAppModule } from './mobile_mini_app/mobile_mini_app.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { GroupModule } from './group/group.module';
import { OrderModule } from './order/order.module';
import { MembershipModule } from './membership/membership.module';
import { PackageModule } from './package/package.module';
import { ServiceModule } from './service/service.module';
import { PackagesServicesModule } from './packages_services/packages_services.module';
import { PurchasedPackageModule } from './purchased_package/purchased_package.module';
import { TournamentModule } from './tournament/tournament.module';
import { FixtureModule } from './fixture/fixture.module';
import { ConfigModule } from '@nestjs/config';
import { FileModule } from './file/file.module';

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
    PackageModule,
    ServiceModule,
    PackagesServicesModule,
    PurchasedPackageModule,
    TournamentModule,
    FixtureModule,
    ConfigModule.forRoot({ cache: true }),
    FileModule,
  ],
})
export class AppModule {}
