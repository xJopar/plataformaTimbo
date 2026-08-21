import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma, UserStatus, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import {
  CorporateEmailAlreadyInUseError,
  GoogleSubjectAlreadyLinkedError,
  InvalidCorporateEmailError,
  InvalidUserStatusTransitionError,
  UserInactiveError,
  UserNotFoundError,
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

interface PrismaKnownRequestError {
  code?: unknown;
  meta?: unknown;
}

const OPERATION_PREAUTHORIZE = 'preauthorizeUser';
const OPERATION_FIND_BY_EMAIL = 'findByCorporateEmail';
const OPERATION_LINK_GOOGLE = 'linkGoogleSubject';
const OPERATION_SAVE_ZOHO = 'saveZohoCrmUserId';
const OPERATION_DEACTIVATE = 'deactivateUser';
const OPERATION_REACTIVATE = 'reactivateUser';

@Injectable()
export class UsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async preauthorizeUser(input: PreauthorizeUserInput): Promise<User> {
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
          eventName: 'access.user_preauthorized',
          actor: {
            actorType: AuditActorType.SYSTEM,
            systemActorKey: PREAUTHORIZE_USER_CLI_SYSTEM_ACTOR_KEY,
          },
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
      return user;
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
      return currentUser;
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

  private normalizeCorporateEmail(corporateEmail: string, operation: string): string {
    const normalizedCorporateEmail = corporateEmail.trim().toLowerCase();

    if (normalizedCorporateEmail.length === 0) {
      throw new InvalidCorporateEmailError(operation);
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
