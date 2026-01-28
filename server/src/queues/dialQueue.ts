import Queue from 'bull';
import logger from '../config/logger.js';
import rcService from '../services/RCService.js';
import { store } from '../storage/RedisStore.js';

interface DialJobData {
  legId: string;
  extensionId: string;
  deviceId?: string; // Device ID for outbound calling
  irsNumber: string;
}

export const dialQueue = new Queue<DialJobData>(
  'dial-queue',
  process.env.REDIS_URL || 'redis://localhost:6379'
);

dialQueue.process(async (job) => {
  const { legId, extensionId, irsNumber } = job.data;
  
  try {
    logger.info(`🎯 [Queue] Starting Call-Out from extension ${extensionId} to ${irsNumber}...`);
    
    // Use Call-Out API - with SuperAdmin JWT this should work!
    const { sessionId, partyId } = await rcService.initiatePlaceCall(
      extensionId,
      irsNumber
    );
    
    logger.info(`✅ [Queue] Call-Out initiated: leg ${legId}, session ${sessionId}, party ${partyId}`);
    
    // Update leg with session info
    await store.updateCallLeg(legId, {
      telephonySessionId: sessionId,
      partyId,
      status: 'RINGING',
    });
    
  } catch (error) {
    logger.error(`❌ [Queue] Failed to dial leg ${legId}:`, error);
    
    // Mark leg as failed
    await store.updateCallLeg(legId, {
      status: 'FAILED',
      endedAt: new Date().toISOString(),
    });
    
    throw error;
  }
});

dialQueue.on('completed', (job) => {
  logger.info(`✅ [Queue] Dial job ${job.id} completed`);
});

dialQueue.on('failed', async (job, err) => {
  logger.error(`❌ [Queue] Dial job ${job?.id} failed:`, err);
  
  // Check if all legs for this job have failed
  try {
    const legId = job?.data?.legId;
    if (!legId) return;
    
    const leg = await store.getCallLeg(legId);
    if (!leg) return;
    
    const jobId = leg.jobId;
    const allLegs = await store.getJobLegs(jobId);
    
    // Check if ALL legs are in terminal states (FAILED or ENDED)
    const allFailed = allLegs.every(l => 
      l.status === 'FAILED' || l.status === 'ENDED'
    );
    
    if (allFailed && allLegs.length > 0) {
      logger.warn(`⚠️  All ${allLegs.length} legs failed for job ${jobId} - auto-failing job and releasing extensions`);
      
      // Update job status to FAILED
      await store.updateJob(jobId, {
        status: 'FAILED',
        stoppedAt: new Date().toISOString()
      });
      
      // Release all extensions
      const extensionIds = allLegs.map(l => l.holdExtensionId);
      const extensionService = await import('../services/ExtensionService.js').then(m => m.default);
      await extensionService.releaseExtensions(extensionIds);
      
      logger.info(`✅ Job ${jobId} auto-failed and ${extensionIds.length} extensions released`);
    }
  } catch (error) {
    logger.error('Error in dialQueue failed handler:', error);
  }
});

export default dialQueue;
