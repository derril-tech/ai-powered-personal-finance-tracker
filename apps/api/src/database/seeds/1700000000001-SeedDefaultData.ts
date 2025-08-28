// Created automatically by Cursor AI (2024-08-27)

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultData1700000000001 implements MigrationInterface {
  name = 'SeedDefaultData1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert default categories
    const categories = [
      // Income
      { id: 'income-salary', name: 'Salary', parentId: null, color: '#10B981', icon: '💰' },
      { id: 'income-freelance', name: 'Freelance', parentId: null, color: '#10B981', icon: '💼' },
      { id: 'income-investment', name: 'Investment', parentId: null, color: '#10B981', icon: '📈' },
      { id: 'income-other', name: 'Other Income', parentId: null, color: '#10B981', icon: '🎁' },

      // Food & Dining
      { id: 'food-groceries', name: 'Groceries', parentId: null, color: '#F59E0B', icon: '🛒' },
      { id: 'food-restaurants', name: 'Restaurants', parentId: null, color: '#F59E0B', icon: '🍽️' },
      { id: 'food-coffee', name: 'Coffee & Drinks', parentId: null, color: '#F59E0B', icon: '☕' },
      { id: 'food-delivery', name: 'Food Delivery', parentId: null, color: '#F59E0B', icon: '🚚' },

      // Transportation
      { id: 'transport-gas', name: 'Gas & Fuel', parentId: null, color: '#3B82F6', icon: '⛽' },
      { id: 'transport-public', name: 'Public Transit', parentId: null, color: '#3B82F6', icon: '🚌' },
      { id: 'transport-uber', name: 'Rideshare', parentId: null, color: '#3B82F6', icon: '🚗' },
      { id: 'transport-maintenance', name: 'Car Maintenance', parentId: null, color: '#3B82F6', icon: '🔧' },

      // Shopping
      { id: 'shopping-clothing', name: 'Clothing', parentId: null, color: '#8B5CF6', icon: '👕' },
      { id: 'shopping-electronics', name: 'Electronics', parentId: null, color: '#8B5CF6', icon: '📱' },
      { id: 'shopping-home', name: 'Home & Garden', parentId: null, color: '#8B5CF6', icon: '🏠' },
      { id: 'shopping-books', name: 'Books & Media', parentId: null, color: '#8B5CF6', icon: '📚' },

      // Entertainment
      { id: 'entertainment-movies', name: 'Movies & TV', parentId: null, color: '#EC4899', icon: '🎬' },
      { id: 'entertainment-games', name: 'Games & Apps', parentId: null, color: '#EC4899', icon: '🎮' },
      { id: 'entertainment-events', name: 'Events & Shows', parentId: null, color: '#EC4899', icon: '🎭' },
      { id: 'entertainment-sports', name: 'Sports & Fitness', parentId: null, color: '#EC4899', icon: '🏃' },

      // Bills & Utilities
      { id: 'bills-rent', name: 'Rent/Mortgage', parentId: null, color: '#EF4444', icon: '🏠' },
      { id: 'bills-utilities', name: 'Utilities', parentId: null, color: '#EF4444', icon: '⚡' },
      { id: 'bills-internet', name: 'Internet & Phone', parentId: null, color: '#EF4444', icon: '📡' },
      { id: 'bills-insurance', name: 'Insurance', parentId: null, color: '#EF4444', icon: '🛡️' },

      // Health & Medical
      { id: 'health-medical', name: 'Medical', parentId: null, color: '#06B6D4', icon: '🏥' },
      { id: 'health-pharmacy', name: 'Pharmacy', parentId: null, color: '#06B6D4', icon: '💊' },
      { id: 'health-dental', name: 'Dental', parentId: null, color: '#06B6D4', icon: '🦷' },
      { id: 'health-vision', name: 'Vision', parentId: null, color: '#06B6D4', icon: '👓' },

      // Education
      { id: 'education-tuition', name: 'Tuition', parentId: null, color: '#84CC16', icon: '🎓' },
      { id: 'education-books', name: 'Books & Supplies', parentId: null, color: '#84CC16', icon: '📖' },
      { id: 'education-courses', name: 'Courses & Training', parentId: null, color: '#84CC16', icon: '📚' },

      // Business
      { id: 'business-office', name: 'Office Supplies', parentId: null, color: '#F97316', icon: '💼' },
      { id: 'business-travel', name: 'Business Travel', parentId: null, color: '#F97316', icon: '✈️' },
      { id: 'business-marketing', name: 'Marketing', parentId: null, color: '#F97316', icon: '📢' },

      // Personal Care
      { id: 'personal-hair', name: 'Hair & Beauty', parentId: null, color: '#A855F7', icon: '💇' },
      { id: 'personal-spa', name: 'Spa & Wellness', parentId: null, color: '#A855F7', icon: '🧖' },

      // Gifts & Donations
      { id: 'gifts-charity', name: 'Charity', parentId: null, color: '#14B8A6', icon: '❤️' },
      { id: 'gifts-presents', name: 'Gifts', parentId: null, color: '#14B8A6', icon: '🎁' },

      // Travel
      { id: 'travel-flights', name: 'Flights', parentId: null, color: '#6366F1', icon: '✈️' },
      { id: 'travel-hotels', name: 'Hotels', parentId: null, color: '#6366F1', icon: '🏨' },
      { id: 'travel-activities', name: 'Activities', parentId: null, color: '#6366F1', icon: '🎯' },

      // Transfer
      { id: 'transfer-internal', name: 'Internal Transfer', parentId: null, color: '#6B7280', icon: '🔄' },
      { id: 'transfer-external', name: 'External Transfer', parentId: null, color: '#6B7280', icon: '💸' },
    ];

    for (const category of categories) {
      await queryRunner.query(`
        INSERT INTO "categories" ("id", "name", "parentId", "color", "icon", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT ("id") DO NOTHING
      `, [category.id, category.name, category.parentId, category.color, category.icon]);
    }

    // Insert example merchants
    const merchants = [
      { name: 'Amazon', website: 'amazon.com', country: 'US', mcc: '5942' },
      { name: 'Walmart', website: 'walmart.com', country: 'US', mcc: '5311' },
      { name: 'Target', website: 'target.com', country: 'US', mcc: '5311' },
      { name: 'Starbucks', website: 'starbucks.com', country: 'US', mcc: '5814' },
      { name: 'McDonald\'s', website: 'mcdonalds.com', country: 'US', mcc: '5814' },
      { name: 'Shell', website: 'shell.com', country: 'US', mcc: '5541' },
      { name: 'ExxonMobil', website: 'exxonmobil.com', country: 'US', mcc: '5541' },
      { name: 'Netflix', website: 'netflix.com', country: 'US', mcc: '4899' },
      { name: 'Spotify', website: 'spotify.com', country: 'US', mcc: '4899' },
      { name: 'Uber', website: 'uber.com', country: 'US', mcc: '4121' },
      { name: 'Lyft', website: 'lyft.com', country: 'US', mcc: '4121' },
      { name: 'DoorDash', website: 'doordash.com', country: 'US', mcc: '5814' },
      { name: 'Uber Eats', website: 'ubereats.com', country: 'US', mcc: '5814' },
      { name: 'Whole Foods Market', website: 'wholefoodsmarket.com', country: 'US', mcc: '5411' },
      { name: 'Trader Joe\'s', website: 'traderjoes.com', country: 'US', mcc: '5411' },
      { name: 'Costco', website: 'costco.com', country: 'US', mcc: '5300' },
      { name: 'Home Depot', website: 'homedepot.com', country: 'US', mcc: '5200' },
      { name: 'Lowe\'s', website: 'lowes.com', country: 'US', mcc: '5200' },
      { name: 'Best Buy', website: 'bestbuy.com', country: 'US', mcc: '5732' },
      { name: 'Apple Store', website: 'apple.com', country: 'US', mcc: '5732' },
    ];

    for (const merchant of merchants) {
      await queryRunner.query(`
        INSERT INTO "merchants" ("name", "website", "country", "mcc", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT ("name") DO NOTHING
      `, [merchant.name, merchant.website, merchant.country, merchant.mcc]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded data
    await queryRunner.query(`DELETE FROM "merchants"`);
    await queryRunner.query(`DELETE FROM "categories"`);
  }
}
