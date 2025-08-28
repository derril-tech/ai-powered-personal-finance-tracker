// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
  ) {}

  async getAccountsByHousehold(householdId: string): Promise<Account[]> {
    return this.accountRepository.find({
      where: { householdId },
      order: { name: 'ASC' },
    });
  }

  async getAccountById(id: string, householdId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, householdId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async syncAccount(id: string, householdId: string): Promise<{ message: string }> {
    const account = await this.getAccountById(id, householdId);

    // In a real implementation, this would trigger the ETL worker to sync the account
    // For now, we'll just update the lastSyncAt timestamp
    await this.accountRepository.update(id, {
      updatedAt: new Date(),
    });

    return { message: 'Account sync initiated successfully' };
  }
}
