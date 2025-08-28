// Created automatically by Cursor AI (2024-12-19)

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection } from './entities/connection.entity';

interface ConnectionResponse {
  id: string;
  provider: 'plaid' | 'tink' | 'truelayer';
  status: 'active' | 'error' | 'disconnected';
  institutionName: string;
  lastSyncAt?: Date;
  errorMessage?: string;
}

interface LinkTokenResponse {
  linkToken: string;
  expiration: Date;
}

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(Connection)
    private connectionRepository: Repository<Connection>,
  ) {}

  async getConnectionsByHousehold(householdId: string): Promise<ConnectionResponse[]> {
    const connections = await this.connectionRepository.find({
      where: { householdId },
      order: { createdAt: 'DESC' },
    });

    return connections.map(connection => ({
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      institutionName: connection.institutionName,
      lastSyncAt: connection.lastSyncAt,
      errorMessage: connection.errorMessage,
    }));
  }

  async createConnection(provider: 'plaid' | 'tink' | 'truelayer', householdId: string): Promise<LinkTokenResponse> {
    // In a real implementation, this would:
    // 1. Call the provider's API to create a link token
    // 2. Store the connection request in the database
    // 3. Return the link token for the frontend to use

    // For now, we'll simulate this process
    const linkToken = `link_${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 1); // Token expires in 1 hour

    // Create a placeholder connection record
    const connection = this.connectionRepository.create({
      householdId,
      provider,
      status: 'pending',
      institutionName: 'Pending Connection',
      linkToken,
      linkTokenExpiration: expiration,
    });

    await this.connectionRepository.save(connection);

    return {
      linkToken,
      expiration,
    };
  }
}
