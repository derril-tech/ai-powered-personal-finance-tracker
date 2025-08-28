// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { SseController } from './sse.controller'
import { SseService } from './sse.service'

@Module({
  controllers: [SseController],
  providers: [SseService],
  exports: [SseService],
})
export class SseModule {}
