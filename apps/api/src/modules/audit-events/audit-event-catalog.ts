import { AuditActorType, AuditOutcome } from '../../generated/prisma/client';

export type AuditEventName =
  | 'security.login_succeeded'
  | 'security.login_denied'
  | 'security.logout'
  | 'access.user_preauthorized'
  | 'access.user_deactivated'
  | 'access.user_reactivated';

export type AuditTargetRule = 'forbidden' | 'user-required';

export type LoginDeniedReasonCode =
  'USER_NOT_AUTHORIZED' | 'USER_INACTIVE' | 'GOOGLE_IDENTITY_MISMATCH' | 'GOOGLE_IDENTITY_INVALID';

export const LOGIN_DENIED_REASON_CODES: readonly LoginDeniedReasonCode[] = [
  'USER_NOT_AUTHORIZED',
  'USER_INACTIVE',
  'GOOGLE_IDENTITY_MISMATCH',
  'GOOGLE_IDENTITY_INVALID',
];

export interface AuditEventCatalogEntry {
  appKey: 'platform';
  actorType: AuditActorType;
  outcome: AuditOutcome;
  targetRule: AuditTargetRule;
  metadataFields: readonly string[];
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
    metadataFields: ['reasonCode'],
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
