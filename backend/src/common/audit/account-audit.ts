import type {
  AccountAuditAction,
  Prisma,
  Role,
} from '../../generated/prisma/client';

export type AuditActorSnapshot = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AuditEventInput = {
  actor?: AuditActorSnapshot | null;
  targetUserId?: string | null;
  action: AccountAuditAction;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason?: string;
  ipAddress?: string;
  userAgentSummary?: string;
};

export function accountAuditData(
  input: AuditEventInput,
): Prisma.AccountAuditEventUncheckedCreateInput {
  return {
    actorUserId: input.actor?.id ?? null,
    targetUserId: input.targetUserId ?? null,
    action: input.action,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reason: input.reason,
    ipAddress: input.ipAddress?.slice(0, 64),
    userAgentSummary: input.userAgentSummary?.slice(0, 512),
    actorNameSnapshot: input.actor?.name,
    actorEmailSnapshot: input.actor?.email,
    actorRoleSnapshot: input.actor?.role,
  };
}
