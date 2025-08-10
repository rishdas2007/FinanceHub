#!/usr/bin/env tsx
// Migration script for the 3-layer economic data model
// Run with: tsx scripts/migrate-economic-data.ts

import { economicDataMigration } from '../server/services/economic-data-migration.js';
import { logger } from '../shared/utils/logger.js';

async function main() {
  try {
    logger.info('🚀 Starting 3-layer economic data migration...');

    // Run the migration
    const result = await economicDataMigration.runMigration();
    
    logger.info('✅ Migration completed successfully:', result);

    // Verify migration
    const verification = await economicDataMigration.verifyMigration();
    
    if (verification.success) {
      logger.info('✅ Migration verification passed:', verification);
    } else {
      logger.error('❌ Migration verification failed:', verification);
      process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if script is executed directly
main();