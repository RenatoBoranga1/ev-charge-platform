import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

export interface UserProfileDto {
  avoidedCo2Kg: number;
  chargingSessions: number;
  email: string;
  estimatedSavings: number;
  id: string;
  name: string;
  totalEnergyKwh: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    return {
      avoidedCo2Kg: Number(user.avoidedCo2Kg),
      chargingSessions: await this.prisma.chargingSession.count({
        where: { userId, deletedAt: null },
      }),
      email: user.email,
      estimatedSavings: Number(user.estimatedSavings),
      id: user.id,
      name: user.name,
      totalEnergyKwh: Number(user.totalEnergyKwh),
    };
  }
}
