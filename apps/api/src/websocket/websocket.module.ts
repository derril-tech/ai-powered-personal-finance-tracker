// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { WebsocketGateway } from './websocket.gateway'
import { WsJwtGuard } from './guards/ws-jwt.guard'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    UsersModule,
  ],
  providers: [WebsocketGateway, WsJwtGuard],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
