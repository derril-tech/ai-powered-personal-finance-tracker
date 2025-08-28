// Created automatically by Cursor AI (2024-08-27)

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HouseholdsService } from './households.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new household' })
  @ApiResponse({ status: 201, description: 'Household created successfully' })
  create(@Body() createHouseholdDto: CreateHouseholdDto) {
    return this.householdsService.create(createHouseholdDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all households' })
  @ApiResponse({ status: 200, description: 'List of households' })
  findAll() {
    return this.householdsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a household by ID' })
  @ApiResponse({ status: 200, description: 'Household found' })
  @ApiResponse({ status: 404, description: 'Household not found' })
  findOne(@Param('id') id: string) {
    return this.householdsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a household' })
  @ApiResponse({ status: 200, description: 'Household updated successfully' })
  @ApiResponse({ status: 404, description: 'Household not found' })
  update(@Param('id') id: string, @Body() updateHouseholdDto: UpdateHouseholdDto) {
    return this.householdsService.update(id, updateHouseholdDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a household' })
  @ApiResponse({ status: 200, description: 'Household deleted successfully' })
  @ApiResponse({ status: 404, description: 'Household not found' })
  remove(@Param('id') id: string) {
    return this.householdsService.remove(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to a household' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  addMember(
    @Param('id') id: string,
    @Body() body: { userId: string; role: string },
  ) {
    return this.householdsService.addMember(id, body.userId, body.role);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from a household' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.householdsService.removeMember(id, userId);
  }
}
