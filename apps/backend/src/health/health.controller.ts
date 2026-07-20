import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check(): Promise<{
    database: string;
    redis: string;
    service: string;
    status: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const redis = await this.redis.ping();
      return {
        database: 'up',
        redis: redis === 'PONG' ? 'up' : 'down',
        service: 'solis-backend',
        status: 'ok',
      };
    } catch {
      throw new ServiceUnavailableException('Dependência indisponível.');
    }
  }
}
