import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../infrastructure/integrations/integrations.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, IntegrationsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
