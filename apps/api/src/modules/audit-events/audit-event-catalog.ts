import { AuditActorType, AuditOutcome } from '../../generated/prisma/client';

export type AuditEventName =
  | 'security.login_succeeded'
  | 'security.login_denied'
  | 'security.logout'
  | 'access.user_preauthorized'
  | 'access.user_deactivated'
  | 'access.user_reactivated';

export type AuditTargetRule = 'forbidden' | 'user-required';

export interface AuditEventCatalogEntry {
  appKey: 'platform';
  actorType: AuditActorType;
  outcome: AuditOutcome;
  targetRule: AuditTargetRule;
  metadataFields: readonly [];
}

export const AUDIT_EVENT_CATALOG: Readonly<Record<AuditEventName, AuditEventCatalogEntry>> = {
  'security.login_succeeded': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'forbidden',
    metadataFields: [],
  },
  'security.login_denied': {
    appKey: 'platform',
    actorType: AuditActorType.ANONYMOUS,
    outcome: AuditOutcome.DENIED,
    targetRule: 'forbidden',
    metadataFields: [],
  },
  'security.logout': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'forbidden',
    metadataFields: [],
  },
  'access.user_preauthorized': {
    appKey: 'platform',
    actorType: AuditActorType.SYSTEM,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: [],
  },
  'access.user_deactivated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: [],
  },
  'access.user_reactivated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: [],
  },
};
