// Created automatically by Cursor AI (2024-12-19)

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalResponseDto, GoalSuggestionDto, GoalWhatIfDto } from './dto/goal-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new goal' })
  @ApiResponse({ status: 201, description: 'Goal created successfully', type: GoalResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createGoal(
    @Request() req,
    @Body() createGoalDto: CreateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalsService.createGoal(req.user.householdId, createGoalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals for the household' })
  @ApiResponse({ status: 200, description: 'Goals retrieved successfully', type: [GoalResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getGoals(@Request() req): Promise<GoalResponseDto[]> {
    return this.goalsService.getGoals(req.user.householdId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific goal by ID' })
  @ApiResponse({ status: 200, description: 'Goal retrieved successfully', type: GoalResponseDto })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getGoal(@Param('id') id: string, @Request() req): Promise<GoalResponseDto> {
    return this.goalsService.getGoal(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal' })
  @ApiResponse({ status: 200, description: 'Goal updated successfully', type: GoalResponseDto })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateGoal(
    @Param('id') id: string,
    @Body() updateGoalDto: UpdateGoalDto,
    @Request() req,
  ): Promise<GoalResponseDto> {
    return this.goalsService.updateGoal(id, updateGoalDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiResponse({ status: 204, description: 'Goal deleted successfully' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteGoal(@Param('id') id: string, @Request() req): Promise<void> {
    return this.goalsService.deleteGoal(id, req.user.id);
  }

  @Get(':id/suggestions')
  @ApiOperation({ summary: 'Get goal suggestions and recommendations' })
  @ApiResponse({ status: 200, description: 'Suggestions retrieved successfully', type: GoalSuggestionDto })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getGoalSuggestions(@Param('id') id: string, @Request() req): Promise<GoalSuggestionDto> {
    return this.goalsService.getGoalSuggestions(id, req.user.id);
  }

  @Get(':id/what-if')
  @ApiOperation({ summary: 'Calculate what-if scenario for a goal' })
  @ApiQuery({ name: 'monthlyContribution', type: 'number', description: 'Monthly contribution amount to test' })
  @ApiResponse({ status: 200, description: 'What-if calculation completed successfully', type: GoalWhatIfDto })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async calculateWhatIf(
    @Param('id') id: string,
    @Query('monthlyContribution') monthlyContribution: string,
    @Request() req,
  ): Promise<GoalWhatIfDto> {
    const contribution = parseFloat(monthlyContribution);
    if (isNaN(contribution) || contribution < 0) {
      throw new Error('Invalid monthly contribution amount');
    }
    return this.goalsService.calculateWhatIf(id, contribution, req.user.id);
  }
}
