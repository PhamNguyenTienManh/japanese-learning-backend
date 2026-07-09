import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Redis(config.getOrThrow<string>('REDIS_URL'));
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
