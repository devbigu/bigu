import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from './common/security/security.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './features/auth/auth.module';
import { UsersModule } from './features/users/users.module';
import { ClientsModule } from './features/clients/clients.module';
import { ProjectsModule } from './features/projects/projects.module';
import { ReferencesModule } from './features/references/references.module';
import { GrowthPlansModule } from './features/growth-plans/growth-plans.module';
import { MonthEndModule } from './features/month-end/month-end.module';
import { ReportsModule } from './features/reports/reports.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { IntegrationsModule } from './infrastructure/integrations/integrations.module';
import { ClientWorkspaceModule } from './features/client-workspace/client-workspace.module';
import { SpreadsheetsModule } from './features/spreadsheets/spreadsheets.module';
import { ProjectResearchModule } from './features/project-research/project-research.module';
import { AdminModule } from './features/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SecurityModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    ReferencesModule,
    GrowthPlansModule,
    MonthEndModule,
    ReportsModule,
    NotificationsModule,
    PrismaModule,
    IntegrationsModule,
    ClientWorkspaceModule,
    SpreadsheetsModule,
    ProjectResearchModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
