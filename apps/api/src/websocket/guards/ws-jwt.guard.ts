// Created automatically by Cursor AI (2024-12-19)

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { UsersService } from '../../users/users.service'

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient()
      const token = this.extractTokenFromHeader(client)
      
      if (!token) {
        throw new WsException('Unauthorized access')
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      })

      const user = await this.usersService.findOne(payload.sub)
      if (!user) {
        throw new WsException('User not found')
      }

      // Attach user info to socket for later use
      client.user = {
        id: user.id,
        householdId: user.householdId,
        organizationId: user.organizationId,
      }

      return true
    } catch (error) {
      throw new WsException('Invalid token')
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const auth = client.handshake.auth.token || client.handshake.headers.authorization
    if (!auth) {
      return undefined
    }

    if (auth.startsWith('Bearer ')) {
      return auth.substring(7)
    }

    return auth
  }
}
