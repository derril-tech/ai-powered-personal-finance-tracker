// Created automatically by Cursor AI (2024-08-27)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { Goal } from './entities/goal.entity';
import { Membership } from '../households/entities/membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Goal, Membership])],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
