import { ConflictException, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  async execute<T>(
    scope: string,
    key: string | undefined,
    producer: () => Promise<T>,
    ttlSeconds = 86_400,
  ): Promise<T> {
    if (!key) return producer();

    const resultKey = `idempotency:result:${scope}:${key}`;
    const lockKey = `idempotency:lock:${scope}:${key}`;
    const cached = await this.redis.client.get(resultKey);
    if (cached) return JSON.parse(cached) as T;

    const acquired = await this.redis.client.set(lockKey, '1', 'EX', 30, 'NX');
    if (!acquired) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'Uma requisição com esta chave ainda está em processamento.',
      });
    }

    try {
      const result = await producer();
      await this.redis.client.set(
        resultKey,
        JSON.stringify(result),
        'EX',
        ttlSeconds,
      );
      return result;
    } finally {
      await this.redis.client.del(lockKey);
    }
  }
}
