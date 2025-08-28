// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from './entities/goal.entity';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalResponseDto, GoalSuggestionDto, GoalWhatIfDto } from './dto/goal-response.dto';
import { Membership, MembershipRole } from '../households/entities/membership.entity';

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  async createGoal(householdId: string, createGoalDto: CreateGoalDto): Promise<GoalResponseDto> {
    const goal = this.goalRepository.create({
      ...createGoalDto,
      householdId,
      targetDate: new Date(createGoalDto.targetDate),
      currentAmount: createGoalDto.currentAmount || 0,
      isActive: createGoalDto.isActive !== undefined ? createGoalDto.isActive : true,
      tags: createGoalDto.tags || [],
    });

    const savedGoal = await this.goalRepository.save(goal);
    return this.getGoalWithDetails(savedGoal.id);
  }

  async getGoals(householdId: string, userId: string): Promise<GoalResponseDto[]> {
    // Check user membership
    const membership = await this.membershipRepository.findOne({
      where: { householdId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this household');
    }

    const goals = await this.goalRepository.find({
      where: { householdId },
      relations: ['account'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(goals.map(goal => this.calculateGoalDetails(goal)));
  }

  async getGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalRepository.findOne({
      where: { id },
      relations: ['account'],
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Check user access
    await this.checkGoalAccess(goal, userId);

    return this.calculateGoalDetails(goal);
  }

  async updateGoal(id: string, updateGoalDto: UpdateGoalDto, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalRepository.findOne({ where: { id } });
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Check user access and permissions
    await this.checkGoalAccess(goal, userId, true);

    if (updateGoalDto.targetDate) {
      goal.targetDate = new Date(updateGoalDto.targetDate);
    }

    Object.assign(goal, updateGoalDto);
    await this.goalRepository.save(goal);

    return this.getGoalWithDetails(id);
  }

  async deleteGoal(id: string, userId: string): Promise<void> {
    const goal = await this.goalRepository.findOne({ where: { id } });
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Check user access and permissions
    await this.checkGoalAccess(goal, userId, true);

    await this.goalRepository.remove(goal);
  }

  async getGoalSuggestions(id: string, userId: string): Promise<GoalSuggestionDto> {
    const goal = await this.goalRepository.findOne({ where: { id } });
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Check user access
    await this.checkGoalAccess(goal, userId);

    return this.calculateGoalSuggestions(goal);
  }

  async calculateWhatIf(id: string, monthlyContribution: number, userId: string): Promise<GoalWhatIfDto> {
    const goal = await this.goalRepository.findOne({ where: { id } });
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Check user access
    await this.checkGoalAccess(goal, userId);

    return this.calculateWhatIfScenario(goal, monthlyContribution);
  }

  private async getGoalWithDetails(id: string): Promise<GoalResponseDto> {
    const goal = await this.goalRepository.findOne({
      where: { id },
      relations: ['account'],
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    return this.calculateGoalDetails(goal);
  }

  private async calculateGoalDetails(goal: Goal): Promise<GoalResponseDto> {
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
    const progressPercentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    
    const suggestions = this.calculateGoalSuggestions(goal);
    const isOnTrack = suggestions.isOnTrack;

    return {
      id: goal.id,
      householdId: goal.householdId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      accountId: goal.accountId,
      accountName: goal.account?.name || 'Unknown Account',
      currentAmount: goal.currentAmount,
      monthlyContribution: goal.monthlyContribution || 0,
      description: goal.description || '',
      isActive: goal.isActive,
      tags: goal.tags || [],
      progressPercentage,
      remainingAmount,
      daysRemaining,
      isOnTrack,
      suggestions,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  private calculateGoalSuggestions(goal: Goal): GoalSuggestionDto {
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
    const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
    const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));

    // Calculate suggested contributions
    const suggestedMonthlyContribution = remainingAmount / monthsRemaining;
    const suggestedWeeklyContribution = remainingAmount / weeksRemaining;
    const suggestedDailyContribution = remainingAmount / daysRemaining;

    // Calculate projected completion with current monthly contribution
    let projectedCompletionDate: Date;
    let isOnTrack: boolean;
    let projectedShortfall: number;

    if (goal.monthlyContribution && goal.monthlyContribution > 0) {
      const monthsToComplete = remainingAmount / goal.monthlyContribution;
      projectedCompletionDate = new Date(now.getTime() + (monthsToComplete * 30 * 24 * 60 * 60 * 1000));
      isOnTrack = projectedCompletionDate <= targetDate;
      projectedShortfall = isOnTrack ? 0 : (goal.monthlyContribution * monthsRemaining) - remainingAmount;
    } else {
      projectedCompletionDate = targetDate;
      isOnTrack = false;
      projectedShortfall = remainingAmount;
    }

    return {
      suggestedMonthlyContribution,
      suggestedWeeklyContribution,
      suggestedDailyContribution,
      projectedCompletionDate,
      isOnTrack,
      projectedShortfall,
    };
  }

  private calculateWhatIfScenario(goal: Goal, monthlyContribution: number): GoalWhatIfDto {
    const now = new Date();
    const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
    
    if (monthlyContribution <= 0) {
      return {
        monthlyContribution: 0,
        projectedCompletionDate: goal.targetDate,
        totalContribution: 0,
        projectedAmount: goal.currentAmount,
      };
    }

    const monthsToComplete = remainingAmount / monthlyContribution;
    const projectedCompletionDate = new Date(now.getTime() + (monthsToComplete * 30 * 24 * 60 * 60 * 1000));
    const totalContribution = monthlyContribution * Math.ceil(monthsToComplete);
    const projectedAmount = goal.currentAmount + totalContribution;

    return {
      monthlyContribution,
      projectedCompletionDate,
      totalContribution,
      projectedAmount,
    };
  }

  private async checkGoalAccess(goal: Goal, userId: string, requireWrite = false): Promise<void> {
    // Get user's membership role
    const membership = await this.membershipRepository.findOne({
      where: { householdId: goal.householdId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this household');
    }

    // Only owners and admins can modify goals
    if (requireWrite && membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to modify goal');
    }
  }
}
