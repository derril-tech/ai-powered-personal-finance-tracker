// Created automatically by Cursor AI (2024-12-19)

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('usage_records')
@Index(['organizationId', 'timestamp'])
@Index(['organizationId', 'recordType', 'timestamp'])
@Index(['userId', 'timestamp'])
export class UsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'record_type' })
  recordType: string; // 'api_call', 'import', 'export', 'report', 'forecast', 'anomaly_check', 'storage', 'connector_sync'

  @Column()
  endpoint: string;

  @Column()
  method: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional data like file size, record count, etc.

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;
}
