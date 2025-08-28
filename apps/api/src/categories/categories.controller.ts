# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get all categories for household' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully', type: [CategoryResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCategories(@Request() req): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getCategories(req.user.id);
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully', type: CategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategory(@Request() req, @Param('id') id: string): Promise<CategoryResponseDto> {
    return this.categoriesService.getCategory(req.user.id, id);
  }

  @Post()
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, description: 'Category created successfully', type: CategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createCategory(
    @Request() req,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.createCategory(req.user.id, createCategoryDto);
  }

  @Put(':id')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully', type: CategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @Request() req,
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.updateCategory(req.user.id, id, updateCategoryDto);
  }

  @Delete(':id')
  @Roles(MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deleteCategory(@Request() req, @Param('id') id: string): Promise<void> {
    return this.categoriesService.deleteCategory(req.user.id, id);
  }

  @Post('assign')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Assign category to transactions' })
  @ApiResponse({ status: 200, description: 'Category assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async assignCategory(
    @Request() req,
    @Body() body: { transaction_ids: string[]; category_id: string },
  ): Promise<{ updated_count: number }> {
    return this.categoriesService.assignCategory(req.user.id, body.transaction_ids, body.category_id);
  }

  @Post('bulk-assign')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Bulk assign categories based on rules' })
  @ApiResponse({ status: 200, description: 'Categories assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async bulkAssignCategories(
    @Request() req,
    @Body() body: { 
      rules: Array<{
        conditions: any[];
        category_id: string;
      }>;
      dry_run?: boolean;
    },
  ): Promise<{ updated_count: number; affected_transactions: string[] }> {
    return this.categoriesService.bulkAssignCategories(req.user.id, body.rules, body.dry_run);
  }
}
