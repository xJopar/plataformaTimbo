import { AuditActorType, AuditOutcome } from '../../generated/prisma/client';

export type AuditEventName =
  | 'security.login_succeeded'
  | 'security.login_denied'
  | 'security.logout'
  | 'access.user_preauthorized'
  | 'access.user_preauthorized_by_administrator'
  | 'access.user_administrative_data_updated'
  | 'access.user_deactivated'
  | 'access.user_reactivated'
  | 'access.platform_admin_assigned'
  | 'access.application_created'
  | 'access.application_updated'
  | 'access.application_deactivated'
  | 'access.application_reactivated'
  | 'access.user_application_assigned'
  | 'access.user_application_unassigned'
  | 'access.application_profile_created'
  | 'access.application_profile_updated'
  | 'access.application_profile_deactivated'
  | 'access.application_profile_reactivated'
  | 'access.application_profile_permission_added'
  | 'access.application_profile_permission_removed'
  | 'access.user_application_profile_assigned'
  | 'access.user_application_profile_unassigned';

export type AuditTargetRule = 'forbidden' | 'user-required' | 'application-required';

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
  'access.user_preauthorized_by_administrator': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: [],
  },
  'access.user_administrative_data_updated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
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
  'access.platform_admin_assigned': {
    appKey: 'platform',
    actorType: AuditActorType.SYSTEM,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: [],
  },
  'access.application_created': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: [],
  },
  'access.application_updated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: [],
  },
  'access.application_deactivated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: [],
  },
  'access.application_reactivated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: [],
  },
  'access.user_application_assigned': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: ['applicationId'],
  },
  'access.user_application_unassigned': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: ['applicationId'],
  },
  'access.application_profile_created': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: ['profileId'],
  },
  'access.application_profile_updated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: ['profileId'],
  },
  'access.application_profile_deactivated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: ['profileId'],
  },
  'access.application_profile_reactivated': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: ['profileId'],
  },
  'access.application_profile_permission_added': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: ['profileId', 'permissionId'],
  },
  'access.application_profile_permission_removed': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'application-required',
    metadataFields: ['profileId', 'permissionId'],
  },
  'access.user_application_profile_assigned': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: ['profileId'],
  },
  'access.user_application_profile_unassigned': {
    appKey: 'platform',
    actorType: AuditActorType.USER,
    outcome: AuditOutcome.SUCCESS,
    targetRule: 'user-required',
    metadataFields: ['profileId'],
  },
};
