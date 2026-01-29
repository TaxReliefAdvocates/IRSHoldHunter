import logger from '../config/logger.js';
import dialQueue from '../queues/dialQueue.js';
import { store } from '../storage/RedisStore.js';
import { twilioCallingService } from './TwilioCallingService.js';
import queueService from './QueueService.js';
import destinationService from './DestinationService.js';
import type { JobWithLegs } from '../types/index.js';

interface StartJobRequest {
  destinationId?: string;
  manualDestination?: string; // NEW: allow manual phone entry
  queueId?: string;
  lineCount?: number;
  poolName?: string;
  specificExtensionIds?: string[];
}

class JobService {
  async startJob(request: StartJobRequest = {}): Promise<string> {
    try {
      const lineCount = request.lineCount || 6;
      
      // Validate line count (Twilio supports 1-100+)
      if (lineCount < 1 || lineCount > 100) {
        throw new Error('Line count must be between 1 and 100');
      }
      
      // Get destination details
      let destinationConfig;
      
      if (request.destinationId) {
        destinationConfig = await store.getDestination(request.destinationId);
        if (!destinationConfig) {
          throw new Error(`Destination ${request.destinationId} not found`);
        }
      } else if (request.manualDestination) {
        // NEW: Use manually entered phone number
        destinationConfig = {
          id: 'manual',
          name: 'Manual Entry',
          phoneNumber: request.manualDestination,
          isDefault: false,
          isActive: true,
          createdAt: Date.now()
        };
      } else {
        // Use default destination
        destinationConfig = await store.getDefaultDestination();
        if (!destinationConfig) {
          throw new Error('No destination configured. Enter a phone number or configure in Settings.');
        }
      }
      
      // Get queue details - MAKE OPTIONAL
      let queueConfig;
      
      if (request.queueId) {
        queueConfig = await store.getQueue(request.queueId);
        if (!queueConfig) {
          throw new Error(`Queue ${request.queueId} not found`);
        }
      } else {
        // Try to get default queue, but don't require it
        queueConfig = await store.getDefaultQueue();
        if (!queueConfig) {
          // Create a dummy queue config if none available
          queueConfig = {
            id: 'none',
            name: 'No Queue',
            phoneNumber: process.env.QUEUE_E164 || '+18885551234',
            extensionId: 'none',
            extensionNumber: 'none',
            isDefault: false,
            createdAt: Date.now()
          };
          logger.warn('⚠️  No queue configured - using default from QUEUE_E164');
        }
      }
      
      logger.info(`🚀 Starting new job: calling ${destinationConfig.phoneNumber} with ${lineCount} lines via Twilio`);
      logger.info(`📍 Destination: ${destinationConfig.name} (${destinationConfig.phoneNumber})`);
      logger.info(`📞 Transfer queue: ${queueConfig.name} (${queueConfig.phoneNumber})`);
      
      // Create job (NO extension management needed)
      const job = await store.createJob({
        irsNumber: destinationConfig.phoneNumber,
        queueNumber: queueConfig.phoneNumber,
        queueId: queueConfig.id,
        queueName: queueConfig.name,
        status: 'RUNNING',
        lineCount,
        poolName: request.poolName
      });
      
      // Update usage stats
      await queueService.updateQueueUsage(queueConfig.id);
      await destinationService.updateDestinationUsage(destinationConfig.id);
      
      logger.info(`📋 Job created: ${job.id}`);
      
      // Create call legs (NO extensions needed for Twilio)
      const legs = [];
      for (let i = 0; i < lineCount; i++) {
        const leg = await store.createCallLeg({
          jobId: job.id,
          status: 'DIALING',
        });
        legs.push(leg);
      }
      
      // Queue dial jobs with staggered delays to respect Twilio rate limits (2 calls/sec)
      // For 22 calls: spread over ~11 seconds (500ms between each)
      for (let i = 0; i < legs.length; i++) {
        const delay = i * 500; // 500ms stagger = 2 calls per second
        
        await dialQueue.add(
          {
            legId: legs[i].id,
            jobId: job.id,
            destinationNumber: destinationConfig.phoneNumber,
          },
          {
            delay,
            attempts: 2, // Allow 1 retry for transient Twilio errors
            removeOnComplete: true,
            backoff: {
              type: 'exponential',
              delay: 2000
            }
          }
        );
        
        logger.info(
          `📞 Leg ${i + 1}/${lineCount} queued via Twilio, delay=${(delay / 1000).toFixed(1)}s`
        );
      }
      
      logger.info(`✅ Job ${job.id} started with ${lineCount} Twilio lines`);
      
      return job.id;
    } catch (error) {
      logger.error('❌ Failed to start job:', error);
      throw error;
    }
  }

  async getJob(jobId: string): Promise<JobWithLegs | null> {
    try {
      const job = await store.getJobWithLegs(jobId);
      return job;
    } catch (error) {
      logger.error(`❌ Failed to get job ${jobId}:`, error);
      throw error;
    }
  }

  async stopJob(jobId: string): Promise<void> {
    try {
      logger.info(`🛑 Stopping job ${jobId}...`);
      
      const job = await store.getJob(jobId);
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      if (job.status === 'TRANSFERRED' || job.status === 'STOPPED') {
        logger.info(`Job ${jobId} already ${job.status}`);
        return;
      }
      
      // Get all legs
      const legs = await store.getJobLegs(jobId);
      
      // Hang up all active Twilio calls
      const activeLegs = legs.filter(
        (leg) => leg.status !== 'ENDED' && leg.status !== 'TRANSFERRED'
      );
      
      logger.info(`Hanging up ${activeLegs.length} active Twilio calls`);
      
      await Promise.allSettled(
        activeLegs.map(async (leg) => {
          if (leg.twilioCallSid) {
            try {
              await twilioCallingService.hangUp(leg.twilioCallSid);
            } catch (error) {
              logger.error(`Failed to hang up ${leg.twilioCallSid}:`, error);
            }
          }
        })
      );
      
      // Update all active legs
      await Promise.all(
        activeLegs.map((leg) =>
          store.updateCallLeg(leg.id, {
            status: 'ENDED',
            endedAt: new Date().toISOString(),
          })
        )
      );
      
      // Update job
      await store.updateJob(jobId, {
        status: 'STOPPED',
        stoppedAt: new Date().toISOString(),
      });
      
      logger.info(`✅ Job ${jobId} stopped`);
    } catch (error) {
      logger.error(`❌ Failed to stop job ${jobId}:`, error);
      throw error;
    }
  }

  async listJobs(limit = 20): Promise<JobWithLegs[]> {
    try {
      const jobs = await store.getActiveJobs();
      return jobs.slice(0, limit);
    } catch (error) {
      logger.error('❌ Failed to list jobs:', error);
      throw error;
    }
  }
}

export default new JobService();
