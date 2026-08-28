import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma, UserStatus, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { resolveCorporateEmailDomainFromEnvironment } from '../../runtime-config';
import { AuditEventsService } from '../audit-events/audit-events.service';
import {
  CorporateEmailAlreadyInUseError,
  CorporateEmailDomainNotAllowedError,
  GoogleSubjectAlreadyLinkedError,
  InvalidCorporateEmailError,
  InvalidUserStatusTransitionError,
  PlatformAdministratorCannotBeDeactivatedError,
  UserInactiveError,
  UserNotFoundError,
  UsersDomainError,
  ZohoCrmUserIdAlreadyInUseError,
} from './users.errors';

const PREAUTHORIZE_USER_CLI_SYSTEM_ACTOR_KEY = 'preauthorize-user-cli';

export interface PreauthorizeUserInput {
  corporateEmail: string;
  displayName?: string;
}

export interface FindUserByCorporateEmailInput {
  corporateEmail: string;
}

export interface LinkGoogleSubjectInput {
  corporateEmail: string;
  googleSubject: string;
  googleDisplayName?: string;
}

export interface SaveZohoCrmUserIdInput {
  corporateEmail: string;
  zohoCrmUserId: string | null;
}

export interface ChangeUserStatusInput {
  corporateEmail: string;
  actorUserId: string;
}

export interface FindActiveUserByIdInput {
  userId: string;
}

export interface FindUserByIdInput {
  userId: string;
}

export interface ListAdministrativeUsersInput {
  search?: string;
}

export interface UpdateAdministrativeUserInput {
  userId: string;
  displayName: string | null;
  actorUserId: string;
}

export interface PreauthorizeUserByAdministratorInput extends PreauthorizeUserInput {
  actorUserId: string;
}

export interface PreauthorizeUsersByAdministratorInput {
  entries: PreauthorizeUserInput[];
  actorUserId: string;
}

export interface ChangeUsersStatusByAdministratorInput {
  userIds: string[];
  status: UserStatus;
  actorUserId: string;
}

export interface ChangeUsersStatusBulkResult {
  userId: string;
  status: 'UPDATED' | 'SKIPPED' | 'REJECTED';
  message?: string;
}

export type PreauthorizeUserBulkResult =
  | { corporateEmail: string; status: 'CREATED'; user: User }
  | { corporateEmail: string; status: 'FAILED'; message: string };

const ADMINISTRATIVE_USER_SELECT = {
  id: true,
  corporateEmail: true,
  displayName: true,
  status: true,
  createdAt: true,
  deactivatedAt: true,
  profileAssignments: {
    where: { profile: { key: 'PLATFORM_ADMIN' } },
    select: { id: true },
  },
} as const satisfies Prisma.UserSelect;

type AdministrativeUserDatabaseRow = Prisma.UserGetPayload<{
  select: typeof ADMINISTRATIVE_USER_SELECT;
}>;

export interface AdministrativeUser {
  id: string;
  corporateEmail: string;
  displayName: string | null;
  status: UserStatus;
  createdAt: Date;
  deactivatedAt: Date | null;
  isPlatformAdministrator: boolean;
}

interface PrismaKnownRequestError {
  code?: unknown;
  meta?: unknown;
}

const OPERATION_PREAUTHORIZE = 'preauthorizeUser';
const OPERATION_FIND_BY_EMAIL = 'findByCorporateEmail';
const OPERATION_FIND_BY_ID = 'findById';
const OPERATION_LINK_GOOGLE = 'linkGoogleSubject';
const OPERATION_SAVE_ZOHO = 'saveZohoCrmUserId';
const OPERATION_DEACTIVATE = 'deactivateUser';
const OPERATION_REACTIVATE = 'reactivateUser';
const OPERATION_LIST_ADMINISTRATIVE_USERS = 'listAdministrativeUsers';
const OPERATION_UPDATE_ADMINISTRATIVE_USER = 'updateAdministrativeUser';
const OPERATION_CHANGE_USERS_STATUS = 'changeUsersStatusByAdministrator';

@Injectable()
export class UsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async preauthorizeUser(input: PreauthorizeUserInput): Promise<User> {
    return this.createPreauthorizedUser(input, {
      eventName: 'access.user_preauthorized',
      actor: {
        actorType: AuditActorType.SYSTEM,
        systemActorKey: PREAUTHORIZE_USER_CLI_SYSTEM_ACTOR_KEY,
      },
    });
  }

  public async preauthorizeUserByAdministrator(
    input: PreauthorizeUserByAdministratorInput,
  ): Promise<User> {
    return this.createPreauthorizedUser(input, {
      eventName: 'access.user_preauthorized_by_administrator',
      actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
    });
  }

  public async preauthorizeUsersByAdministrator(
    input: PreauthorizeUsersByAdministratorInput,
  ): Promise<PreauthorizeUserBulkResult[]> {
    const results: PreauthorizeUserBulkResult[] = [];
    for (const entry of input.entries) {
      try {
        const user = await this.preauthorizeUserByAdministrator({
          corporateEmail: entry.corporateEmail,
          displayName: entry.displayName,
          actorUserId: input.actorUserId,
        });
        results.push({ corporateEmail: user.corporateEmail, status: 'CREATED', user });
      } catch (error) {
        results.push({
          corporateEmail: entry.corporateEmail,
          status: 'FAILED',
          message:
            error instanceof UsersDomainError
              ? error.message
              : 'No pudimos preautorizar el usuario.',
        });
      }
    }
    return results;
  }

  public async listAdministrativeUsers(
    input: ListAdministrativeUsersInput = {},
  ): Promise<AdministrativeUser[]> {
    const search = this.normalizeAdministrativeSearch(input.search);

    const users = await this.prisma.user.findMany({
      where:
        search === undefined
          ? undefined
          : {
              OR: [
                { corporateEmail: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
              ],
            },
      select: ADMINISTRATIVE_USER_SELECT,
      orderBy: [{ corporateEmail: 'asc' }],
    });
    return users.map(toAdministrativeUser);
  }

  public async updateAdministrativeUser(
    input: UpdateAdministrativeUserInput,
  ): Promise<AdministrativeUser> {
    const displayName = this.normalizeAdministrativeDisplayName(input.displayName);

    return this.translatePrismaErrors(OPERATION_UPDATE_ADMINISTRATIVE_USER, () =>
      this.prisma.$transaction(async (transactionClient) => {
        const user = await transactionClient.user.update({
          where: { id: input.userId },
          data: { displayName },
          select: ADMINISTRATIVE_USER_SELECT,
        });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.user_administrative_data_updated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'user', targetId: user.id },
        });
        return toAdministrativeUser(user);
      }),
    );
  }

  private async createPreauthorizedUser(
    input: PreauthorizeUserInput,
    audit: {
      eventName: 'access.user_preauthorized' | 'access.user_preauthorized_by_administrator';
      actor:
        | { actorType: typeof AuditActorType.SYSTEM; systemActorKey: 'preauthorize-user-cli' }
        | { actorType: typeof AuditActorType.USER; actorUserId: string };
    },
  ): Promise<User> {
    const corporateEmail = this.normalizeCorporateEmail(
      input.corporateEmail,
      OPERATION_PREAUTHORIZE,
    );
    const displayName = this.normalizeOptionalDisplayName(input.displayName);

    return this.translatePrismaErrors(OPERATION_PREAUTHORIZE, () =>
      this.prisma.$transaction(async (transactionClient) => {
        const user = await transactionClient.user.create({
          data: { corporateEmail, displayName },
        });

        await this.auditEventsService.append(transactionClient, {
          eventName: audit.eventName,
          actor: audit.actor,
          target: { targetType: 'user', targetId: user.id },
        });

        return user;
      }),
    );
  }

  public async findByCorporateEmail(input: FindUserByCorporateEmailInput): Promise<User> {
    const corporateEmail = this.normalizeCorporateEmail(
      input.corporateEmail,
      OPERATION_FIND_BY_EMAIL,
    );
    const user = await this.prisma.user.findUnique({ where: { corporateEmail } });

    if (user === null) {
      throw new UserNotFoundError(OPERATION_FIND_BY_EMAIL);
    }

    return user;
  }

  public async findActiveUserById(input: FindActiveUserByIdInput): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id: input.userId, status: UserStatus.ACTIVE },
    });
  }

  public async findUserById(input: FindUserByIdInput): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (user === null) {
      throw new UserNotFoundError(OPERATION_FIND_BY_ID);
    }
    return user;
  }

  public async linkGoogleSubject(
    transactionClient: Prisma.TransactionClient,
    input: LinkGoogleSubjectInput,
  ): Promise<User> {
    const corporateEmail = this.normalizeCorporateEmail(
      input.corporateEmail,
      OPERATION_LINK_GOOGLE,
    );
    const users = await this.translatePrismaErrors(OPERATION_LINK_GOOGLE, () =>
      transactionClient.user.updateManyAndReturn({
        where: {
          corporateEmail,
          googleSubject: null,
          status: UserStatus.ACTIVE,
        },
        data: { googleSubject: input.googleSubject },
      }),
    );

    const user = users[0];

    if (user !== undefined) {
      return this.saveGoogleDisplayNameWhenAbsent(transactionClient, user, input.googleDisplayName);
    }

    const currentUser = await this.findUserByNormalizedCorporateEmail(
      transactionClient,
      corporateEmail,
      OPERATION_LINK_GOOGLE,
    );

    if (currentUser.status !== UserStatus.ACTIVE) {
      throw new UserInactiveError(OPERATION_LINK_GOOGLE);
    }

    if (currentUser.googleSubject === input.googleSubject) {
      return this.saveGoogleDisplayNameWhenAbsent(
        transactionClient,
        currentUser,
        input.googleDisplayName,
      );
    }

    throw new GoogleSubjectAlreadyLinkedError(OPERATION_LINK_GOOGLE);
  }

  public async saveZohoCrmUserId(input: SaveZohoCrmUserIdInput): Promise<User> {
    const corporateEmail = this.normalizeCorporateEmail(input.corporateEmail, OPERATION_SAVE_ZOHO);

    return this.translatePrismaErrors(OPERATION_SAVE_ZOHO, () =>
      this.prisma.user.update({
        where: { corporateEmail },
        data: { zohoCrmUserId: input.zohoCrmUserId },
      }),
    );
  }

  public async deactivateUser(input: ChangeUserStatusInput): Promise<User> {
    const corporateEmail = this.normalizeCorporateEmail(input.corporateEmail, OPERATION_DEACTIVATE);

    return this.translatePrismaErrors(OPERATION_DEACTIVATE, () =>
      this.prisma.$transaction(async (transactionClient) => {
        const platformAdministratorAssignment =
          await transactionClient.userProfileAssignment.findFirst({
            where: {
              user: { corporateEmail },
              profile: { key: 'PLATFORM_ADMIN' },
            },
            select: { id: true },
          });
        if (platformAdministratorAssignment !== null) {
          throw new PlatformAdministratorCannotBeDeactivatedError();
        }
        const users = await transactionClient.user.updateManyAndReturn({
          where: { corporateEmail, status: UserStatus.ACTIVE },
          data: { status: UserStatus.INACTIVE, deactivatedAt: new Date() },
        });

        const user = users[0];

        if (user === undefined) {
          return this.throwInvalidStatusTransition(
            transactionClient,
            corporateEmail,
            OPERATION_DEACTIVATE,
            UserStatus.INACTIVE,
          );
        }

        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.user_deactivated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'user', targetId: user.id },
        });

        return user;
      }),
    );
  }

  public async reactivateUser(input: ChangeUserStatusInput): Promise<User> {
    const corporateEmail = this.normalizeCorporateEmail(input.corporateEmail, OPERATION_REACTIVATE);

    return this.translatePrismaErrors(OPERATION_REACTIVATE, () =>
      this.prisma.$transaction(async (transactionClient) => {
        const users = await transactionClient.user.updateManyAndReturn({
          where: { corporateEmail, status: UserStatus.INACTIVE },
          data: { status: UserStatus.ACTIVE, deactivatedAt: null },
        });

        const user = users[0];

        if (user === undefined) {
          return this.throwInvalidStatusTransition(
            transactionClient,
            corporateEmail,
            OPERATION_REACTIVATE,
            UserStatus.ACTIVE,
          );
        }

        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.user_reactivated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'user', targetId: user.id },
        });

        return user;
      }),
    );
  }

  public async changeUsersStatusByAdministrator(
    input: ChangeUsersStatusByAdministratorInput,
  ): Promise<ChangeUsersStatusBulkResult[]> {
    return Promise.all(
      input.userIds.map((userId) =>
        this.changeSingleUserStatusByAdministrator({
          userId,
          requestedStatus: input.status,
          actorUserId: input.actorUserId,
        }),
      ),
    );
  }

  private async changeSingleUserStatusByAdministrator(input: {
    userId: string;
    requestedStatus: UserStatus;
    actorUserId: string;
  }): Promise<ChangeUsersStatusBulkResult> {
    return this.translatePrismaErrors(OPERATION_CHANGE_USERS_STATUS, () =>
      this.prisma.$transaction(async (transactionClient) => {
        const user = await transactionClient.user.findUnique({ where: { id: input.userId } });
        if (user === null) {
          return {
            userId: input.userId,
            status: 'REJECTED',
            message: 'No se encontró el usuario seleccionado.',
          };
        }
        if (user.status === input.requestedStatus) {
          return {
            userId: user.id,
            status: 'SKIPPED',
            message:
              input.requestedStatus === UserStatus.ACTIVE
                ? 'El usuario ya se encuentra activo.'
                : 'El usuario ya se encuentra inactivo.',
          };
        }

        if (input.requestedStatus === UserStatus.INACTIVE) {
          const platformAdministratorAssignment =
            await transactionClient.userProfileAssignment.findFirst({
              where: { userId: user.id, profile: { key: 'PLATFORM_ADMIN' } },
              select: { id: true },
            });
          if (platformAdministratorAssignment !== null) {
            return {
              userId: user.id,
              status: 'REJECTED',
              message: 'Primero se debe revocar el rol de administrador de plataforma.',
            };
          }
        }

        const updatedUser = await transactionClient.user.update({
          where: { id: user.id },
          data:
            input.requestedStatus === UserStatus.ACTIVE
              ? { status: UserStatus.ACTIVE, deactivatedAt: null }
              : { status: UserStatus.INACTIVE, deactivatedAt: new Date() },
        });
        await this.auditEventsService.append(transactionClient, {
          eventName:
            input.requestedStatus === UserStatus.ACTIVE
              ? 'access.user_reactivated'
              : 'access.user_deactivated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'user', targetId: updatedUser.id },
        });

        return { userId: updatedUser.id, status: 'UPDATED' };
      }),
    );
  }

  private normalizeAdministrativeSearch(search: string | undefined): string | undefined {
    if (search === undefined) {
      return undefined;
    }
    const normalizedSearch = search.trim();
    if (normalizedSearch.length > 120) {
      throw new Error(
        `La búsqueda de usuarios supera el límite de ${OPERATION_LIST_ADMINISTRATIVE_USERS}.`,
      );
    }
    return normalizedSearch.length === 0 ? undefined : normalizedSearch;
  }

  private normalizeAdministrativeDisplayName(displayName: string | null): string | null {
    if (displayName === null) {
      return null;
    }
    if (typeof displayName !== 'string') {
      throw new Error('El nombre visible administrativo debe ser texto o null.');
    }
    const normalizedDisplayName = displayName.trim();
    return normalizedDisplayName.length === 0 ? null : normalizedDisplayName;
  }

  private normalizeCorporateEmail(corporateEmail: string, operation: string): string {
    const normalizedCorporateEmail = corporateEmail.trim().toLowerCase();

    if (normalizedCorporateEmail.length === 0) {
      throw new InvalidCorporateEmailError(operation);
    }

    const corporateEmailDomain = resolveCorporateEmailDomainFromEnvironment();
    if (!normalizedCorporateEmail.endsWith(`@${corporateEmailDomain}`)) {
      throw new CorporateEmailDomainNotAllowedError(operation, corporateEmailDomain);
    }

    return normalizedCorporateEmail;
  }

  private normalizeOptionalDisplayName(displayName: string | undefined): string | undefined {
    if (displayName === undefined) {
      return undefined;
    }

    const normalizedDisplayName = displayName.trim();

    // El nombre vacío se conserva como ausencia porque sigue siendo opcional hasta el primer login.
    return normalizedDisplayName.length === 0 ? undefined : normalizedDisplayName;
  }

  private async saveGoogleDisplayNameWhenAbsent(
    transactionClient: Prisma.TransactionClient,
    user: User,
    googleDisplayName: string | undefined,
  ): Promise<User> {
    const normalizedGoogleDisplayName = this.normalizeOptionalDisplayName(googleDisplayName);
    if (user.displayName !== null || normalizedGoogleDisplayName === undefined) {
      return user;
    }

    const updatedUsers = await transactionClient.user.updateManyAndReturn({
      where: { id: user.id, displayName: null },
      data: { displayName: normalizedGoogleDisplayName },
    });
    return updatedUsers[0] ?? user;
  }

  private async findUserByNormalizedCorporateEmail(
    transactionClient: Prisma.TransactionClient,
    corporateEmail: string,
    operation: string,
  ): Promise<User> {
    const user = await transactionClient.user.findUnique({ where: { corporateEmail } });

    if (user === null) {
      throw new UserNotFoundError(operation);
    }

    return user;
  }

  private async throwInvalidStatusTransition(
    transactionClient: Prisma.TransactionClient,
    corporateEmail: string,
    operation: string,
    requestedStatus: UserStatus,
  ): Promise<never> {
    const user = await this.findUserByNormalizedCorporateEmail(
      transactionClient,
      corporateEmail,
      operation,
    );
    throw new InvalidUserStatusTransitionError(operation, user.status, requestedStatus);
  }

  private async translatePrismaErrors<T>(operation: string, execute: () => Promise<T>): Promise<T> {
    try {
      return await execute();
    } catch (error) {
      throw this.toDomainError(operation, error);
    }
  }

  private toDomainError(operation: string, error: unknown): unknown {
    if (!this.isPrismaKnownRequestError(error)) {
      return error;
    }

    if (error.code === 'P2025') {
      return new UserNotFoundError(operation, error);
    }

    if (error.code !== 'P2002') {
      return error;
    }

    const uniqueField = this.getUniqueField(error.meta);

    switch (uniqueField) {
      case 'corporateEmail':
        return new CorporateEmailAlreadyInUseError(operation, error);
      case 'googleSubject':
        return new GoogleSubjectAlreadyLinkedError(operation, error);
      case 'zohoCrmUserId':
        return new ZohoCrmUserIdAlreadyInUseError(operation, error);
      default:
        return error;
    }
  }

  private isPrismaKnownRequestError(error: unknown): error is PrismaKnownRequestError {
    return typeof error === 'object' && error !== null && 'code' in error;
  }

  private getUniqueField(
    meta: unknown,
  ): 'corporateEmail' | 'googleSubject' | 'zohoCrmUserId' | undefined {
    if (typeof meta !== 'object' || meta === null || !('target' in meta)) {
      return undefined;
    }

    const { target } = meta;

    if (!Array.isArray(target) || target.length !== 1 || typeof target[0] !== 'string') {
      return undefined;
    }

    switch (target[0]) {
      case 'corporateEmail':
      case 'corporate_email':
        return 'corporateEmail';
      case 'googleSubject':
      case 'google_subject':
        return 'googleSubject';
      case 'zohoCrmUserId':
      case 'zoho_crm_user_id':
        return 'zohoCrmUserId';
      default:
        return undefined;
    }
  }
}

function toAdministrativeUser(user: AdministrativeUserDatabaseRow): AdministrativeUser {
  const { profileAssignments, ...administrativeUser } = user;
  return {
    ...administrativeUser,
    isPlatformAdministrator: profileAssignments.length > 0,
  };
}
