import Queue from 'bull';
import logger from '../config/logger.js';
import { store } from '../storage/RedisStore.js';
import { twilioCallingService } from '../services/TwilioCallingService.js';

interface DialJobData {
  legId: string;
  jobId: string;
  destinationNumber: string;
}

export const dialQueue = new Queue<DialJobData>(
  'dial-queue',
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    settings: {
      maxStalledCount: 2,
      stalledInterval: 30000,
    },
    limiter: {
      max: 2, // Max 2 jobs
      duration: 1000, // Per second (Twilio rate limit)
      bounceBack: false
    }
  }
);

// Process up to 5 jobs concurrently (rate limited by limiter above)
dialQueue.process(5, async (job) => {
  const { legId, jobId, destinationNumber } = job.data;
  
  try {
    logger.info(`🎯 [Twilio Queue] Starting call to ${destinationNumber}...`);
    
    // Use Twilio to initiate the call
    const { callSid } = await twilioCallingService.initiateCall(
      destinationNumber,
      { legId, jobId }
    );
    
    logger.info(`✅ [Twilio Queue] Call initiated: ${callSid}`);
    
    // Update leg with Twilio call SID
    await store.updateCallLeg(legId, {
      twilioCallSid: callSid,
      status: 'DIALING',
    });
    
  } catch (error) {
    logger.error(`❌ [Twilio Queue] Failed to dial leg ${legId}:`, error);
    
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

dialQueue.on('active', (job) => {
  logger.info(`⚡ [Queue] Processing dial job ${job.id} for leg ${job.data.legId}`);
});

dialQueue.on('waiting', (jobId) => {
  logger.debug(`⏳ [Queue] Job ${jobId} is waiting`);
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
      logger.warn(`⚠️  All ${allLegs.length} legs failed for job ${jobId} - auto-failing job`);
      
      // Update job status to FAILED
      await store.updateJob(jobId, {
        status: 'FAILED',
        stoppedAt: new Date().toISOString()
      });
      
      logger.info(`✅ Job ${jobId} auto-failed (Twilio - no extensions to release)`);
    }
  } catch (error) {
    logger.error('Error in dialQueue failed handler:', error);
  }
});

export default dialQueue;
