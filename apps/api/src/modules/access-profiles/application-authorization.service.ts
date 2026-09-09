import { Injectable } from '@nestjs/common';
import {
  AccessProfileScope,
  AccessProfileStatus,
  ApplicationPermissionStatus,
  ApplicationStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApplicationAuthorizationService {
  public constructor(private readonly prisma: PrismaService) {}

  public async hasApplicationAccess(userId: string, applicationKey: string): Promise<boolean> {
    return (
      (await this.prisma.userApplicationAssignment.count({
        where: {
          userId,
          user: { status: UserStatus.ACTIVE },
          application: { key: applicationKey, status: ApplicationStatus.ACTIVE },
        },
      })) > 0
    );
  }

  public async hasApplicationPermission(
    userId: string,
    applicationKey: string,
    permissionKey: string,
  ): Promise<boolean> {
    return (
      (await this.prisma.userProfileAssignment.count({
        where: {
          userId,
          user: {
            status: UserStatus.ACTIVE,
            applicationAssignments: {
              some: { application: { key: applicationKey, status: ApplicationStatus.ACTIVE } },
            },
          },
          profile: {
            scope: AccessProfileScope.APPLICATION,
            status: AccessProfileStatus.ACTIVE,
            application: { key: applicationKey, status: ApplicationStatus.ACTIVE },
            permissions: {
              some: {
                permission: { key: permissionKey, status: ApplicationPermissionStatus.ACTIVE },
              },
            },
          },
        },
      })) > 0
    );
  }
}
