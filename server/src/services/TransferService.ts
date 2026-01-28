import logger from '../config/logger.js';
import rcService from './RCService.js';
import { store } from '../storage/RedisStore.js';

class TransferService {
  async attemptTransfer(jobId: string, legId: string): Promise<boolean> {
    try {
      // Atomic lock acquisition
      const locked = await store.acquireWinnerLock(jobId, legId);
      
      if (!locked) {
        logger.info(`⏭️  Leg ${legId} lost race - another leg already won`);
        return false;
      }
      
      logger.info(`🏆 Leg ${legId} WON the race! Starting transfer...`);
      
      // Get leg and job data
      const leg = await store.getCallLeg(legId);
      const job = await store.getJob(jobId);
      
      if (!leg || !leg.telephonySessionId || !leg.partyId) {
        logger.error(`❌ Leg ${legId} missing required data for transfer`);
        await store.releaseWinnerLock(jobId);
        return false;
      }
      
      if (!job) {
        logger.error(`❌ Job ${jobId} not found`);
        await store.releaseWinnerLock(jobId);
        return false;
      }
      
      // Execute transfer
      await rcService.transferToQueue(
        leg.telephonySessionId,
        leg.partyId,
        job.queueNumber
      );
      
      // Update leg
      await store.updateCallLeg(legId, {
        status: 'TRANSFERRED',
        transferredAt: new Date().toISOString(),
      });
      
      // Update job
      await store.updateJob(jobId, {
        status: 'TRANSFERRED',
        winningLegId: legId,
        transferredAt: new Date().toISOString(),
      });
      
      logger.info(`✅ Transfer completed successfully for job ${jobId}`);
      
      // Hang up losers (async - don't block)
      setImmediate(() => this.cleanupLosingLegs(jobId, legId));
      
      return true;
    } catch (error) {
      logger.error(`❌ Transfer failed for leg ${legId}:`, error);
      
      // Release lock on failure so another leg can try
      await store.releaseWinnerLock(jobId);
      
      throw error;
    }
  }

  async cleanupLosingLegs(jobId: string, winningLegId: string): Promise<void> {
    try {
      logger.info(`🧹 Cleaning up losing legs for job ${jobId}...`);
      
      const allLegs = await store.getJobLegs(jobId);
      
      const losingLegs = allLegs.filter(
        (leg) =>
          leg.id !== winningLegId &&
          leg.status !== 'ENDED' &&
          leg.status !== 'TRANSFERRED'
      );
      
      logger.info(`📴 Hanging up ${losingLegs.length} losing legs`);
      
      // Hang up all losing legs
      await Promise.allSettled(
        losingLegs.map((leg) => {
          if (leg.telephonySessionId && leg.partyId) {
            return rcService.hangUpParty(leg.telephonySessionId, leg.partyId);
          }
          return Promise.resolve();
        })
      );
      
      // Update legs in storage
      await Promise.all(
        losingLegs.map((leg) =>
          store.updateCallLeg(leg.id, {
            status: 'ENDED',
            endedAt: new Date().toISOString(),
          })
        )
      );
      
      logger.info(`✅ Cleanup completed for job ${jobId}`);
    } catch (error) {
      logger.error(`❌ Cleanup failed for job ${jobId}:`, error);
    }
  }
}

export default new TransferService();
