// src/kantan/kantan.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KantanController } from './kantan.controller';
import { KantanService } from './kantan.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [KantanController],
  providers: [KantanService],
  exports: [KantanService],
})
export class KantanModule {}
