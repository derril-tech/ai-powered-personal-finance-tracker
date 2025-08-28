// Created automatically by Cursor AI (2024-08-27)

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Household } from './entities/household.entity';
import { Membership } from './entities/membership.entity';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';

@Injectable()
export class HouseholdsService {
  constructor(
    @InjectRepository(Household)
    private householdsRepository: Repository<Household>,
    @InjectRepository(Membership)
    private membershipsRepository: Repository<Membership>,
  ) {}

  async create(createHouseholdDto: CreateHouseholdDto): Promise<Household> {
    const household = this.householdsRepository.create(createHouseholdDto);
    return this.householdsRepository.save(household);
  }

  async findAll(): Promise<Household[]> {
    return this.householdsRepository.find({
      relations: ['organization', 'memberships', 'memberships.user'],
    });
  }

  async findOne(id: string): Promise<Household> {
    const household = await this.householdsRepository.findOne({
      where: { id },
      relations: ['organization', 'memberships', 'memberships.user'],
    });
    if (!household) {
      throw new NotFoundException(`Household with ID ${id} not found`);
    }
    return household;
  }

  async update(id: string, updateHouseholdDto: UpdateHouseholdDto): Promise<Household> {
    const household = await this.findOne(id);
    Object.assign(household, updateHouseholdDto);
    return this.householdsRepository.save(household);
  }

  async remove(id: string): Promise<void> {
    const household = await this.findOne(id);
    await this.householdsRepository.remove(household);
  }

  async addMember(householdId: string, userId: string, role: string): Promise<Membership> {
    const membership = this.membershipsRepository.create({
      householdId,
      userId,
      role,
    });
    return this.membershipsRepository.save(membership);
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    const membership = await this.membershipsRepository.findOne({
      where: { householdId, userId },
    });
    if (membership) {
      await this.membershipsRepository.remove(membership);
    }
  }
}
