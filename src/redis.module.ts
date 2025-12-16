import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        if (!process.env.REDIS_URL) {
          throw new Error('REDIS_URL is not defined');
        }

        return new Redis(process.env.REDIS_URL);
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
