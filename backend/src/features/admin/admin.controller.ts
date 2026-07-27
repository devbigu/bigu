import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { Role } from '../../generated/prisma/client';
import { AdminService } from './admin.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { ListManagedUsersQueryDto } from './dto/list-managed-users-query.dto';
import { ReactivateUserDto } from './dto/reactivate-user.dto';
import { ReassignWorkDto } from './dto/reassign-work.dto';
import { ResetManagedUserPasswordDto } from './dto/reset-managed-user-password.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('users')
  listUsers(@Query() query: ListManagedUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  createUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateManagedUserDto,
  ) {
    return this.adminService.createUser(actor, dto);
  }

  @Get('users/:userId')
  findUser(@Param('userId') userId: string) {
    return this.adminService.findUser(userId);
  }

  @Patch('users/:userId')
  updateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.adminService.updateUser(actor, userId, dto);
  }

  @Post('users/:userId/reset-password')
  resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: ResetManagedUserPasswordDto,
  ) {
    return this.adminService.resetPassword(actor, userId, dto);
  }

  @Post('users/:userId/revoke-sessions')
  revokeSessions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.adminService.revokeSessions(actor, userId);
  }

  @Post('users/:userId/suspend')
  suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.suspend(actor, userId, dto);
  }

  @Post('users/:userId/deactivate')
  deactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: DeactivateUserDto,
  ) {
    return this.adminService.deactivate(actor, userId, dto);
  }

  @Post('users/:userId/reactivate')
  reactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: ReactivateUserDto,
  ) {
    return this.adminService.reactivate(actor, userId, dto);
  }

  @Post('users/:userId/reassign-work')
  reassignWork(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: ReassignWorkDto,
  ) {
    return this.adminService.reassignWork(actor, userId, dto);
  }

  @Get('users/:userId/audit-log')
  userAuditLog(@Param('userId') userId: string) {
    return this.adminService.auditLog(userId);
  }

  @Get('audit-log')
  auditLog() {
    return this.adminService.auditLog();
  }
}
