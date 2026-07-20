import { randomBytes, randomUUID } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@solis/database';
import * as argon2 from 'argon2';

import { environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserProfile {
  avoidedCo2Kg: number;
  chargingSessions: number;
  email: string;
  estimatedSavings: number;
  id: string;
  name: string;
  totalEnergyKwh: number;
}

export interface AuthSession {
  tokens: AuthTokens;
  user: UserProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterDto): Promise<AuthSession> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: environment.defaultTenantSlug },
    });
    if (!tenant || tenant.deletedAt) {
      throw new ConflictException('Tenant padrão não está disponível.');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          passwordHash: await argon2.hash(input.password),
          phone: input.phone.trim(),
          tenantId: tenant.id,
        },
      });
      return this.createSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma conta com este e-mail.');
      }
      throw error;
    }
  }

  async login(input: LoginDto): Promise<AuthSession> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: environment.defaultTenantSlug },
    });
    const user = tenant
      ? await this.prisma.user.findUnique({
          where: {
            tenantId_email: {
              email: input.email.trim().toLowerCase(),
              tenantId: tenant.id,
            },
          },
        })
      : null;

    if (
      !user ||
      user.deletedAt ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    return this.createSession(user);
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenId = rawToken.split('.', 1)[0];
    if (!tokenId) throw new UnauthorizedException('Refresh token inválido.');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });
    if (!stored || !(await argon2.verify(stored.tokenHash, rawToken))) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Reutilização de refresh token detectada.');
    }
    if (stored.expiresAt <= new Date() || stored.user.deletedAt) {
      throw new UnauthorizedException('Refresh token expirado.');
    }

    const next = await this.buildRefreshToken(stored.familyId);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.create({
        data: {
          expiresAt: next.expiresAt,
          familyId: stored.familyId,
          id: next.id,
          tokenHash: next.hash,
          userId: stored.userId,
        },
      });
      const rotated = await transaction.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: {
          replacedByTokenId: next.id,
          revokedAt: new Date(),
        },
      });
      if (rotated.count !== 1) {
        throw new UnauthorizedException('Refresh token já foi utilizado.');
      }
    });

    return {
      accessToken: await this.signAccessToken(stored.user),
      refreshToken: next.raw,
    };
  }

  private async createSession(user: User): Promise<AuthSession> {
    const familyId = randomUUID();
    const refresh = await this.buildRefreshToken(familyId);
    await this.prisma.refreshToken.create({
      data: {
        expiresAt: refresh.expiresAt,
        familyId,
        id: refresh.id,
        tokenHash: refresh.hash,
        userId: user.id,
      },
    });

    const chargingSessions = await this.prisma.chargingSession.count({
      where: { userId: user.id, deletedAt: null },
    });
    return {
      tokens: {
        accessToken: await this.signAccessToken(user),
        refreshToken: refresh.raw,
      },
      user: {
        avoidedCo2Kg: Number(user.avoidedCo2Kg),
        chargingSessions,
        email: user.email,
        estimatedSavings: Number(user.estimatedSavings),
        id: user.id,
        name: user.name,
        totalEnergyKwh: Number(user.totalEnergyKwh),
      },
    };
  }

  private async signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync(
      {
        email: user.email,
        role: user.role,
        sub: user.id,
        tenantId: user.tenantId,
      },
      {
        expiresIn: environment.jwtAccessTtl as never,
        secret: environment.jwtAccessSecret,
      },
    );
  }

  private async buildRefreshToken(familyId: string): Promise<{
    expiresAt: Date;
    familyId: string;
    hash: string;
    id: string;
    raw: string;
  }> {
    const id = randomUUID();
    const raw = `${id}.${randomBytes(48).toString('base64url')}`;
    return {
      expiresAt: new Date(
        Date.now() + environment.refreshTokenTtlDays * 86_400_000,
      ),
      familyId,
      hash: await argon2.hash(raw),
      id,
      raw,
    };
  }
}
