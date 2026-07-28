import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProfileTheme, type User } from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import { DomainEventPublisher } from '../outbox/domain-event-publisher';
import type {
  NotificationPreferencesDto,
  PrivacyPreferencesDto,
  UpdateProfileDto,
  UserPreferencesDto,
} from './dto/update-profile.dto';

export interface ProfileNotifications {
  chargingNotifications: boolean;
  emailReceipts: boolean;
  favoriteStationAlerts: boolean;
  promotions: boolean;
  reservationAlerts: boolean;
}

export interface ProfilePrivacy {
  analyticsConsent: boolean;
  marketingConsent: boolean;
  personalizedOffers: boolean;
}

export interface UserProfileDto {
  accountDeletionRequestedAt?: string;
  avatarUrl?: string;
  avoidedCo2Kg: number;
  city?: string;
  chargingSessions: number;
  country: string;
  email: string;
  estimatedSavings: number;
  firstName: string;
  id: string;
  language: string;
  lastName: string;
  name: string;
  notifications: ProfileNotifications;
  phone?: string;
  preferences: { dataSaver: boolean };
  privacy: ProfilePrivacy;
  recordVersion: number;
  state?: string;
  theme: ProfileTheme;
  totalEnergyKwh: number;
}

const notificationDefaults: ProfileNotifications = {
  chargingNotifications: true,
  emailReceipts: true,
  favoriteStationAlerts: true,
  promotions: false,
  reservationAlerts: true,
};

const privacyDefaults: ProfilePrivacy = {
  analyticsConsent: false,
  marketingConsent: false,
  personalizedOffers: false,
};

function jsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function booleanSettings<T extends object>(
  value: Prisma.JsonValue | null,
  defaults: T,
): T {
  const record = jsonRecord(value);
  return Object.fromEntries(
    Object.entries(defaults as Record<string, boolean>).map(([key, fallback]) => [
      key,
      typeof record[key] === 'boolean' ? record[key] : fallback,
    ]),
  ) as T;
}

function splitName(user: User): { firstName: string; lastName: string } {
  if (user.firstName) {
    return {
      firstName: user.firstName,
      lastName: user.lastName ?? '',
    };
  }
  const [firstName = user.name, ...rest] = user.name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

@Injectable()
export class UserProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    return this.toProfile(await this.requireUser(userId));
  }

  async updateProfile(
    input: UpdateProfileDto,
    authUser: AuthUser,
    correlationId: string,
  ): Promise<UserProfileDto> {
    const current = await this.requireUser(authUser.sub);
    const currentName = splitName(current);
    const firstName = input.firstName?.trim() ?? currentName.firstName;
    const lastName = input.lastName?.trim() ?? currentName.lastName;

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const result = await transaction.user.updateMany({
          data: {
            ...(input.avatarUrl !== undefined
              ? { avatarUrl: input.avatarUrl.trim() || null }
              : {}),
            ...(input.city !== undefined
              ? { city: input.city.trim() || null }
              : {}),
            ...(input.country !== undefined
              ? { country: input.country.toUpperCase() }
              : {}),
            ...(input.email !== undefined
              ? { email: input.email.trim().toLowerCase() }
              : {}),
            firstName,
            ...(input.language !== undefined
              ? { language: input.language }
              : {}),
            lastName: lastName || null,
            name: [firstName, lastName].filter(Boolean).join(' '),
            ...(input.notifications !== undefined
              ? {
                  notificationPreferences: this.mergeSettings(
                    current.notificationPreferences,
                    input.notifications,
                  ),
                }
              : {}),
            ...(input.phone !== undefined
              ? { phone: input.phone.trim() || null }
              : {}),
            ...(input.preferences !== undefined
              ? {
                  preferences: this.mergeSettings(
                    current.preferences,
                    input.preferences,
                  ),
                }
              : {}),
            ...(input.privacy !== undefined
              ? {
                  privacyPreferences: this.mergeSettings(
                    current.privacyPreferences,
                    input.privacy,
                  ),
                }
              : {}),
            ...(input.state !== undefined
              ? { state: input.state.toUpperCase() }
              : {}),
            ...(input.theme !== undefined ? { theme: input.theme } : {}),
            version: { increment: 1 },
          },
          where: {
            deletedAt: null,
            id: authUser.sub,
            version: input.recordVersion,
          },
        });
        if (result.count !== 1) this.optimisticLockConflict();
        const user = await transaction.user.findUniqueOrThrow({
          where: { id: authUser.sub },
        });
        await transaction.auditLog.create({
          data: {
            action: 'USER_PROFILE_UPDATED',
            after: { version: user.version },
            before: { version: current.version },
            correlationId,
            entityId: user.id,
            entityType: 'User',
            tenantId: authUser.tenantId,
            userId: authUser.sub,
          },
        });
        await this.outbox.publish(
          {
            aggregateId: user.id,
            aggregateType: 'User',
            eventType: 'UserProfileUpdated',
            payload: {
              correlationId,
              userId: user.id,
              version: user.version,
            },
            tenantId: authUser.tenantId,
          },
          transaction,
        );
        return user;
      });
      return this.toProfile(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Já existe uma conta com este e-mail.',
        });
      }
      throw error;
    }
  }

  async requestAccountDeletion(
    authUser: AuthUser,
    recordVersion: number,
    correlationId: string,
  ): Promise<UserProfileDto> {
    const current = await this.requireUser(authUser.sub);
    if (current.accountDeletionRequestedAt) return this.toProfile(current);
    const requestedAt = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        data: {
          accountDeletionRequestedAt: requestedAt,
          version: { increment: 1 },
        },
        where: {
          deletedAt: null,
          id: authUser.sub,
          version: recordVersion,
        },
      });
      if (result.count !== 1) this.optimisticLockConflict();
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: authUser.sub },
      });
      await transaction.auditLog.create({
        data: {
          action: 'ACCOUNT_DELETION_REQUESTED',
          after: { requestedAt, version: user.version },
          correlationId,
          entityId: user.id,
          entityType: 'User',
          tenantId: authUser.tenantId,
          userId: authUser.sub,
        },
      });
      await this.outbox.publish(
        {
          aggregateId: user.id,
          aggregateType: 'User',
          eventType: 'AccountDeletionRequested',
          payload: {
            correlationId,
            requestedAt: requestedAt.toISOString(),
            userId: user.id,
          },
          tenantId: authUser.tenantId,
        },
        transaction,
      );
      return user;
    });
    return this.toProfile(updated);
  }

  private async toProfile(user: User): Promise<UserProfileDto> {
    const { firstName, lastName } = splitName(user);
    return {
      ...(user.accountDeletionRequestedAt
        ? {
            accountDeletionRequestedAt:
              user.accountDeletionRequestedAt.toISOString(),
          }
        : {}),
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      avoidedCo2Kg: Number(user.avoidedCo2Kg),
      ...(user.city ? { city: user.city } : {}),
      chargingSessions: await this.prisma.chargingSession.count({
        where: { userId: user.id, deletedAt: null },
      }),
      country: user.country,
      email: user.email,
      estimatedSavings: Number(user.estimatedSavings),
      firstName,
      id: user.id,
      language: user.language,
      lastName,
      name: user.name,
      notifications: booleanSettings(
        user.notificationPreferences,
        notificationDefaults,
      ),
      ...(user.phone ? { phone: user.phone } : {}),
      preferences: booleanSettings(user.preferences, { dataSaver: false }),
      privacy: booleanSettings(user.privacyPreferences, privacyDefaults),
      recordVersion: user.version,
      ...(user.state ? { state: user.state } : {}),
      theme: user.theme,
      totalEnergyKwh: Number(user.totalEnergyKwh),
    };
  }

  private mergeSettings(
    current: Prisma.JsonValue | null,
    update:
      | NotificationPreferencesDto
      | PrivacyPreferencesDto
      | UserPreferencesDto,
  ): Prisma.InputJsonValue {
    return {
      ...jsonRecord(current),
      ...update,
    };
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  private optimisticLockConflict(): never {
    throw new ConflictException({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      message:
        'O perfil foi alterado em outro dispositivo. Atualize e tente novamente.',
    });
  }
}
