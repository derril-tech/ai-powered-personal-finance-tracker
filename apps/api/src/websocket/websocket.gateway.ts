// Created automatically by Cursor AI (2024-12-19)

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { WsJwtGuard } from './guards/ws-jwt.guard'

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string
    householdId: string
    organizationId: string
  }
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
@UseGuards(WsJwtGuard)
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private connectedClients = new Map<string, AuthenticatedSocket>()

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authentication is handled by WsJwtGuard
      if (client.user) {
        this.connectedClients.set(client.user.id, client)
        
        // Join household room for real-time updates
        client.join(`household:${client.user.householdId}`)
        
        // Join organization room for admin updates
        client.join(`organization:${client.user.organizationId}`)
        
        console.log(`Client connected: ${client.user.id} (Household: ${client.user.householdId})`)
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      client.disconnect()
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.connectedClients.delete(client.user.id)
      console.log(`Client disconnected: ${client.user.id}`)
    }
  }

  @SubscribeMessage('subscribe:balances')
  handleSubscribeBalances(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { accountIds?: string[] }
  ) {
    if (client.user) {
      if (data.accountIds) {
        data.accountIds.forEach(accountId => {
          client.join(`account:${accountId}:balances`)
        })
      }
      client.emit('subscribed:balances', { success: true })
    }
  }

  @SubscribeMessage('subscribe:budgets')
  handleSubscribeBudgets(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { budgetIds?: string[] }
  ) {
    if (client.user) {
      if (data.budgetIds) {
        data.budgetIds.forEach(budgetId => {
          client.join(`budget:${budgetId}:progress`)
        })
      }
      client.emit('subscribed:budgets', { success: true })
    }
  }

  @SubscribeMessage('subscribe:alerts')
  handleSubscribeAlerts(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.user) {
      client.join(`household:${client.user.householdId}:alerts`)
      client.emit('subscribed:alerts', { success: true })
    }
  }

  @SubscribeMessage('subscribe:imports')
  handleSubscribeImports(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { importId: string }
  ) {
    if (client.user) {
      client.join(`import:${data.importId}:progress`)
      client.emit('subscribed:imports', { success: true })
    }
  }

  @SubscribeMessage('subscribe:forecasts')
  handleSubscribeForecasts(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { forecastId: string }
  ) {
    if (client.user) {
      client.join(`forecast:${data.forecastId}:progress`)
      client.emit('subscribed:forecasts', { success: true })
    }
  }

  // Methods to emit updates to connected clients
  emitBalanceUpdate(householdId: string, accountId: string, balance: any) {
    this.server.to(`household:${householdId}`).emit('balance:updated', {
      accountId,
      balance,
      timestamp: new Date().toISOString(),
    })
  }

  emitBudgetProgressUpdate(householdId: string, budgetId: string, progress: any) {
    this.server.to(`household:${householdId}`).emit('budget:progress', {
      budgetId,
      progress,
      timestamp: new Date().toISOString(),
    })
  }

  emitAlertUpdate(householdId: string, alert: any) {
    this.server.to(`household:${householdId}:alerts`).emit('alert:new', {
      alert,
      timestamp: new Date().toISOString(),
    })
  }

  emitImportProgressUpdate(importId: string, progress: any) {
    this.server.to(`import:${importId}:progress`).emit('import:progress', {
      importId,
      progress,
      timestamp: new Date().toISOString(),
    })
  }

  emitForecastProgressUpdate(forecastId: string, progress: any) {
    this.server.to(`forecast:${forecastId}:progress`).emit('forecast:progress', {
      forecastId,
      progress,
      timestamp: new Date().toISOString(),
    })
  }

  emitTransactionUpdate(householdId: string, transaction: any) {
    this.server.to(`household:${householdId}`).emit('transaction:new', {
      transaction,
      timestamp: new Date().toISOString(),
    })
  }

  emitAccountSyncUpdate(householdId: string, accountId: string, status: any) {
    this.server.to(`household:${householdId}`).emit('account:sync', {
      accountId,
      status,
      timestamp: new Date().toISOString(),
    })
  }

  // Admin methods for organization-wide updates
  emitOrganizationUpdate(organizationId: string, update: any) {
    this.server.to(`organization:${organizationId}`).emit('organization:update', {
      update,
      timestamp: new Date().toISOString(),
    })
  }

  // Utility method to get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size
  }

  // Utility method to get connected clients for a household
  getConnectedClientsForHousehold(householdId: string): AuthenticatedSocket[] {
    return Array.from(this.connectedClients.values()).filter(
      client => client.user?.householdId === householdId
    )
  }
}
