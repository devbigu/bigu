import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountAuditAction,
  Prisma,
  ProjectStatus,
  Role,
  User,
  UserProvisioningSource,
  UserStatus,
} from '../../generated/prisma/client';
import { accountAuditData } from '../../common/audit/account-audit';
import { PasswordService } from '../../common/security/password.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { ListManagedUsersQueryDto } from './dto/list-managed-users-query.dto';
import { ReactivateUserDto } from './dto/reactivate-user.dto';
import { ReassignWorkDto } from './dto/reassign-work.dto';
import { ResetManagedUserPasswordDto } from './dto/reset-managed-user-password.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

const activeProjectStatuses = [ProjectStatus.DRAFT, ProjectStatus.ACTIVE];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async dashboard() {
    const [
      activeEmployees,
      suspendedEmployees,
      deactivatedEmployees,
      passwordChangesRequired,
      unassignedActiveProjects,
      recentAuditEvents,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { status: UserStatus.DEACTIVATED } }),
      this.prisma.user.count({ where: { mustChangePassword: true } }),
      this.prisma.project.count({
        where: {
          status: { in: activeProjectStatuses },
          assignedUserId: null,
        },
      }),
      this.prisma.accountAuditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          actorUser: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      activeEmployees,
      suspendedEmployees,
      deactivatedEmployees,
      passwordChangesRequired,
      unassignedActiveProjects,
      recentAuditEvents,
    };
  }

  async listUsers(query: ListManagedUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.designation) {
      where.designation = {
        equals: query.designation.trim(),
        mode: 'insensitive',
      };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return users.map((user) => this.toManagedUser(user));
  }

  async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        createdBy: { select: { id: true, name: true, status: true } },
        deactivatedBy: { select: { id: true, name: true, status: true } },
        _count: {
          select: {
            projectsAssigned: {
              where: { status: { in: activeProjectStatuses } },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Employee account was not found.');
    const auditLog = await this.auditLog(userId, 20);
    return {
      ...this.toManagedUser(user),
      createdBy: user.createdBy,
      deactivatedBy: user.deactivatedBy,
      activeSessionCount: user.refreshTokenHash ? 1 : 0,
      activeResponsibilities: {
        assignedProjects: user._count.projectsAssigned,
      },
      auditLog,
    };
  }

  async createUser(actor: AuthenticatedUser, dto: CreateManagedUserDto) {
    if (dto.status === UserStatus.DEACTIVATED) {
      throw new BadRequestException(
        'Create the employee as active or suspended, then use deactivation with a reason.',
      );
    }
    const name = dto.name.trim();
    const email = this.normalizeEmail(dto.email);
    const duplicate = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('A user with this email already exists.');
    }
    const generatedPassword = dto.generatePassword
      ? this.passwords.generateTemporaryPassword()
      : undefined;
    const initialPassword = generatedPassword ?? dto.initialPassword;
    if (!initialPassword) {
      throw new BadRequestException('An initial password is required.');
    }
    this.passwords.validate(initialPassword, { name, email });
    const passwordHash = await this.passwords.hash(initialPassword);
    const username = await this.availableUsername(email);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          username,
          email,
          passwordHash,
          role: dto.role,
          designation: dto.designation.trim(),
          status: dto.status,
          mustChangePassword: dto.mustChangePassword,
          createdById: actor.id,
          provisioningSource: UserProvisioningSource.ADMIN,
          suspensionReason:
            dto.status === UserStatus.SUSPENDED
              ? 'Account created in suspended state.'
              : null,
        },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: created.id,
          action: AccountAuditAction.USER_CREATED,
          newValue: {
            name: created.name,
            email: created.email,
            role: created.role,
            designation: created.designation,
            status: created.status,
            mustChangePassword: created.mustChangePassword,
          },
        }),
      });
      return created;
    });

    return {
      user: this.toManagedUser(user),
      ...(generatedPassword
        ? { generatedTemporaryPassword: generatedPassword }
        : {}),
    };
  }

  async updateUser(
    actor: AuthenticatedUser,
    userId: string,
    dto: UpdateManagedUserDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (!current)
        throw new NotFoundException('Employee account was not found.');
      if (
        current.role === Role.ADMIN &&
        current.status === UserStatus.ACTIVE &&
        dto.role &&
        dto.role !== Role.ADMIN
      ) {
        await this.assertAnotherActiveAdmin(tx, userId, actor);
      }
      const data: Prisma.UserUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.role !== undefined) data.role = dto.role;
      if (dto.designation !== undefined) {
        data.designation = dto.designation.trim();
      }
      const updated = await tx.user.update({ where: { id: userId }, data });
      const roleChanged = current.role !== updated.role;
      const designationChanged = current.designation !== updated.designation;
      if (roleChanged) {
        await tx.user.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 }, refreshTokenHash: null },
        });
        await tx.accountAuditEvent.create({
          data: accountAuditData({
            actor,
            targetUserId: userId,
            action: AccountAuditAction.ROLE_CHANGED,
            oldValue: { role: current.role },
            newValue: { role: updated.role },
          }),
        });
      }
      if (designationChanged) {
        await tx.accountAuditEvent.create({
          data: accountAuditData({
            actor,
            targetUserId: userId,
            action: AccountAuditAction.DESIGNATION_CHANGED,
            oldValue: { designation: current.designation },
            newValue: { designation: updated.designation },
          }),
        });
      }
      if (current.name !== updated.name) {
        await tx.accountAuditEvent.create({
          data: accountAuditData({
            actor,
            targetUserId: userId,
            action: AccountAuditAction.USER_PROFILE_CHANGED,
            oldValue: { name: current.name },
            newValue: { name: updated.name },
          }),
        });
      }
      const finalUser = roleChanged
        ? await tx.user.findUniqueOrThrow({ where: { id: userId } })
        : updated;
      return this.toManagedUser(finalUser);
    });
  }

  async resetPassword(
    actor: AuthenticatedUser,
    userId: string,
    dto: ResetManagedUserPasswordDto,
  ) {
    const user = await this.requireUser(userId);
    const generatedPassword = dto.generatePassword
      ? this.passwords.generateTemporaryPassword()
      : undefined;
    const temporaryPassword = generatedPassword ?? dto.temporaryPassword;
    if (!temporaryPassword) {
      throw new BadRequestException('A temporary password is required.');
    }
    this.passwords.validate(temporaryPassword, user);
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: dto.mustChangePassword,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
          refreshTokenHash: null,
        },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: userId,
          action: AccountAuditAction.PASSWORD_RESET,
          newValue: { mustChangePassword: dto.mustChangePassword },
        }),
      });
      return result;
    });
    return {
      user: this.toManagedUser(updated),
      ...(generatedPassword
        ? { generatedTemporaryPassword: generatedPassword }
        : {}),
    };
  }

  async revokeSessions(actor: AuthenticatedUser, userId: string) {
    await this.requireUser(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 }, refreshTokenHash: null },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: userId,
          action: AccountAuditAction.SESSIONS_REVOKED,
        }),
      });
    });
    return { success: true };
  }

  async suspend(actor: AuthenticatedUser, userId: string, dto: SuspendUserDto) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (!current)
        throw new NotFoundException('Employee account was not found.');
      if (current.role === Role.ADMIN && current.status === UserStatus.ACTIVE) {
        await this.assertAnotherActiveAdmin(tx, userId, actor);
      }
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.SUSPENDED,
          suspensionReason: dto.reason.trim(),
          suspensionReviewDate: dto.reviewDate
            ? new Date(dto.reviewDate)
            : null,
          tokenVersion: { increment: 1 },
          refreshTokenHash: null,
        },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: userId,
          action: AccountAuditAction.USER_SUSPENDED,
          oldValue: { status: current.status },
          newValue: {
            status: UserStatus.SUSPENDED,
            reviewDate: dto.reviewDate ?? null,
          },
          reason: dto.reason.trim(),
        }),
      });
      return result;
    });
    return this.toManagedUser(updated);
  }

  async deactivate(
    actor: AuthenticatedUser,
    userId: string,
    dto: DeactivateUserDto,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (!current)
        throw new NotFoundException('Employee account was not found.');
      if (current.role === Role.ADMIN && current.status === UserStatus.ACTIVE) {
        await this.assertAnotherActiveAdmin(tx, userId, actor);
      }
      const replacement = await this.validateReplacement(
        tx,
        userId,
        dto.replacementUserId,
      );
      let reassignedProjects = 0;
      if (dto.reassignActiveWork) {
        const result = await tx.project.updateMany({
          where: {
            assignedUserId: userId,
            status: { in: activeProjectStatuses },
          },
          data: { assignedUserId: replacement?.id ?? null },
        });
        reassignedProjects = result.count;
      }
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DEACTIVATED,
          deactivatedAt: new Date(),
          deactivatedById: actor.id,
          deactivationReason: dto.reason.trim(),
          suspensionReason: null,
          suspensionReviewDate: null,
          tokenVersion: { increment: 1 },
          refreshTokenHash: null,
        },
      });
      if (dto.reassignActiveWork) {
        await tx.accountAuditEvent.create({
          data: accountAuditData({
            actor,
            targetUserId: userId,
            action: AccountAuditAction.RESPONSIBILITIES_REASSIGNED,
            oldValue: { assignedUserId: userId },
            newValue: {
              assignedUserId: replacement?.id ?? null,
              projects: reassignedProjects,
            },
          }),
        });
      }
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: userId,
          action: AccountAuditAction.USER_DEACTIVATED,
          oldValue: { status: current.status },
          newValue: { status: UserStatus.DEACTIVATED },
          reason: dto.reason.trim(),
        }),
      });
      return result;
    });
    return this.toManagedUser(updated);
  }

  async reactivate(
    actor: AuthenticatedUser,
    userId: string,
    dto: ReactivateUserDto,
  ) {
    const current = await this.requireUser(userId);
    if (current.status === UserStatus.ACTIVE) {
      throw new ConflictException('This employee is already active.');
    }
    const generatedPassword = dto.generatePassword
      ? this.passwords.generateTemporaryPassword()
      : undefined;
    const temporaryPassword = generatedPassword ?? dto.temporaryPassword;
    if (!temporaryPassword) {
      throw new BadRequestException(
        'Reactivation requires a temporary password.',
      );
    }
    this.passwords.validate(temporaryPassword, current);
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const role = dto.role ?? Role.STAFF;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          role,
          status: UserStatus.ACTIVE,
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          deactivatedAt: null,
          deactivatedById: null,
          deactivationReason: null,
          suspensionReason: null,
          suspensionReviewDate: null,
          tokenVersion: { increment: 1 },
          refreshTokenHash: null,
        },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: userId,
          action: AccountAuditAction.USER_REACTIVATED,
          oldValue: { status: current.status, role: current.role },
          newValue: {
            status: UserStatus.ACTIVE,
            role,
            mustChangePassword: true,
          },
        }),
      });
      return result;
    });
    return {
      user: this.toManagedUser(updated),
      ...(generatedPassword
        ? { generatedTemporaryPassword: generatedPassword }
        : {}),
    };
  }

  async reassignWork(
    actor: AuthenticatedUser,
    userId: string,
    dto: ReassignWorkDto,
  ) {
    await this.requireUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const replacement = await this.validateReplacement(
        tx,
        userId,
        dto.replacementUserId,
      );
      const result = await tx.project.updateMany({
        where: {
          assignedUserId: userId,
          status: { in: activeProjectStatuses },
        },
        data: { assignedUserId: replacement?.id ?? null },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId: userId,
          action: AccountAuditAction.RESPONSIBILITIES_REASSIGNED,
          oldValue: { assignedUserId: userId },
          newValue: {
            assignedUserId: replacement?.id ?? null,
            projects: result.count,
          },
        }),
      });
      return { reassignedProjects: result.count };
    });
  }

  auditLog(userId?: string, take = 100) {
    return this.prisma.accountAuditEvent.findMany({
      where: userId ? { targetUserId: userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: {
        actorUser: { select: { id: true, name: true, status: true } },
        targetUser: { select: { id: true, name: true, status: true } },
      },
    });
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Employee account was not found.');
    return user;
  }

  private async assertAnotherActiveAdmin(
    tx: Prisma.TransactionClient,
    targetUserId: string,
    actor: AuthenticatedUser,
  ) {
    const otherAdmins = await tx.user.count({
      where: {
        id: { not: targetUserId },
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    if (otherAdmins === 0) {
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor,
          targetUserId,
          action: AccountAuditAction.LAST_ADMIN_OPERATION_BLOCKED,
        }),
      });
      throw new ForbiddenException(
        'The final active administrator cannot be demoted, suspended, or deactivated.',
      );
    }
  }

  private async validateReplacement(
    tx: Prisma.TransactionClient,
    targetUserId: string,
    replacementUserId?: string,
  ) {
    if (!replacementUserId) return null;
    if (replacementUserId === targetUserId) {
      throw new BadRequestException(
        'The replacement employee must be different.',
      );
    }
    const replacement = await tx.user.findUnique({
      where: { id: replacementUserId },
      select: { id: true, status: true },
    });
    if (!replacement || replacement.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'Replacement employee must have an active account.',
      );
    }
    return replacement;
  }

  private async availableUsername(email: string) {
    const raw = email.split('@')[0].replace(/[^a-z0-9_.]/g, '');
    const base = (raw || 'employee').slice(0, 24);
    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const username = suffix === 0 ? base : `${base.slice(0, 24)}.${suffix}`;
      const existing = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!existing) return username;
    }
    throw new ConflictException(
      'Unable to generate a unique username for this email.',
    );
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private toManagedUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      designation: user.designation,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
      deactivatedAt: user.deactivatedAt,
      deactivationReason: user.deactivationReason,
      suspensionReason: user.suspensionReason,
      suspensionReviewDate: user.suspensionReviewDate,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
