import 'dotenv/config';
import { store } from '../src/storage/RedisStore.js';
import logger from '../src/config/logger.js';

async function seedQueue() {
  logger.info('🌱 Seeding default queue...');
  
  try {
    // Create your main IRS queue with direct phone number
    await store.saveQueue({
      id: 'queue-main',
      name: 'Test IRS Queue',
      extensionNumber: '999',
      phoneNumber: '+19492268820', // YOUR DIRECT QUEUE NUMBER
      isDefault: true,
      tags: ['irs', 'main'],
      lastUsed: new Date().toISOString()
    });
    
    logger.info('✅ Default queue created:');
    logger.info('   Name: Test IRS Queue');
    logger.info('   Phone: +19492268820');
    logger.info('   Extension: 999');
    
    // Verify it was saved
    const queue = await store.getDefaultQueue();
    if (queue) {
      logger.info('✅ Verified: Default queue loaded successfully');
      logger.info(`   Queue ID: ${queue.id}`);
      logger.info(`   Phone Number: ${queue.phoneNumber}`);
    } else {
      logger.error('❌ Verification failed: Could not load default queue');
    }
    
  } catch (error) {
    logger.error('❌ Failed to seed queue:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedQueue();
