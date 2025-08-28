// Created automatically by Cursor AI (2024-12-19)

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ConnectionProvider {
  PLAID = 'plaid',
  TINK = 'tink',
  TRUELAYER = 'truelayer',
}

export enum ConnectionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

@Entity('connections')
@Index(['householdId', 'provider'])
@Index(['status'])
export class Connection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'household_id', type: 'uuid' })
  householdId: string;

  @Column({
    type: 'enum',
    enum: ConnectionProvider,
  })
  provider: ConnectionProvider;

  @Column({
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.PENDING,
  })
  status: ConnectionStatus;

  @Column({ name: 'institution_name' })
  institutionName: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken: string;

  @Column({ name: 'link_token', nullable: true })
  linkToken: string;

  @Column({ name: 'link_token_expiration', nullable: true })
  linkTokenExpiration: Date;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional provider-specific data

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
