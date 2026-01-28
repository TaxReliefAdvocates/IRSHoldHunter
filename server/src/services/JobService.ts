import logger from '../config/logger.js';
import dialQueue from '../queues/dialQueue.js';
import { store } from '../storage/RedisStore.js';
import extensionService from './ExtensionService.js';
import queueService from './QueueService.js';
import destinationService from './DestinationService.js';
import type { JobWithLegs } from '../types/index.js';

interface StartJobRequest {
  destinationId?: string;
  queueId?: string;
  lineCount?: number;
  poolName?: string;
  specificExtensionIds?: string[];
}

class JobService {
  async startJob(request: StartJobRequest = {}): Promise<string> {
    try {
      const lineCount = request.lineCount || 6;
      
      // Get destination details
      let destinationConfig;
      
      if (request.destinationId) {
        destinationConfig = await store.getDestination(request.destinationId);
        if (!destinationConfig) {
          throw new Error(`Destination ${request.destinationId} not found`);
        }
      } else {
        // Use default destination
        destinationConfig = await store.getDefaultDestination();
        if (!destinationConfig) {
          throw new Error('No default destination configured. Please select a destination.');
        }
      }
      
      // Get queue details
      let queueConfig;
      
      if (request.queueId) {
        queueConfig = await store.getQueue(request.queueId);
        if (!queueConfig) {
          throw new Error(`Queue ${request.queueId} not found`);
        }
      } else {
        // Use default queue
        queueConfig = await store.getDefaultQueue();
        if (!queueConfig) {
          throw new Error('No default queue configured. Please select a queue or run /api/queues/sync');
        }
      }
      
      logger.info(`🚀 Starting new job: calling ${destinationConfig.phoneNumber} with ${lineCount} lines`);
      logger.info(`📍 Destination: ${destinationConfig.name} (${destinationConfig.phoneNumber})`);
      logger.info(`📞 Transfer queue: ${queueConfig.name} (${queueConfig.phoneNumber})`);
      
      // Determine which extensions to use
      let extensionIds: string[];
      
      if (request.specificExtensionIds && request.specificExtensionIds.length > 0) {
        // User manually selected extensions
        logger.info(`Using ${request.specificExtensionIds.length} manually selected extensions`);
        extensionIds = request.specificExtensionIds;
      } else if (request.poolName) {
        // Use saved pool
        logger.info(`Using extension pool: ${request.poolName}`);
        const poolExtensions = await store.getExtensionPool(request.poolName);
        extensionIds = poolExtensions.slice(0, lineCount);
      } else {
        // Auto-select available extensions
        logger.info(`Auto-selecting ${lineCount} available extensions`);
        
        // Get authenticated user info
        const userDataStr = await store.getConfig('rc_authenticated_user');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        
        // Filter extensions based on user permissions
        let available = await extensionService.getFilteredExtensions({
          enabledOnly: true,
          availableOnly: true
        });
        
        // If user is not an admin, they can only use their own extension
        if (userData && !userData.isAdmin) {
          logger.info(`🔒 Non-admin user: restricting to extension ${userData.extensionNumber}`);
          available = available.filter(e => e.extensionNumber === userData.extensionNumber);
          
          if (available.length === 0) {
            throw new Error(`Your extension ${userData.extensionNumber} is not available or not enabled for calling. Please enable it in the Extensions tab.`);
          }
        }
        
        extensionIds = available.slice(0, lineCount).map(e => e.id);
      }
      
      if (extensionIds.length < lineCount) {
        throw new Error(`Only ${extensionIds.length} extensions available, need ${lineCount}`);
      }
      
      // Create job
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
      
      // Reserve extensions for this job
      await extensionService.reserveExtensions(extensionIds, job.id);
      
      // Create call legs and queue dial jobs with stagger
      for (let i = 0; i < extensionIds.length; i++) {
        const extensionId = extensionIds[i];
        
        // Create leg record
        const leg = await store.createCallLeg({
          jobId: job.id,
          holdExtensionId: extensionId,
          status: 'DIALING',
        });
        
        // Queue dial with 2-second stagger
        const delay = i * 2000;
        
        await dialQueue.add(
          {
            legId: leg.id,
            extensionId,
            irsNumber: destinationConfig.phoneNumber,
          },
          {
            delay,
            attempts: 1,
            removeOnComplete: true,
          }
        );
        
        logger.info(
          `📞 Leg ${i + 1}/6 queued: extension=${extensionId}, delay=${delay}ms`
        );
      }
      
      logger.info(`✅ Job ${job.id} started with 6 legs`);
      
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
      
      // Import rcService here to avoid circular dependency
      const { default: rcService } = await import('./RCService.js');
      
      // Get all legs
      const legs = await store.getJobLegs(jobId);
      
      // Hang up all active legs
      const activeLegs = legs.filter(
        (leg) => leg.status !== 'ENDED' && leg.status !== 'TRANSFERRED'
      );
      
      await Promise.allSettled(
        activeLegs.map((leg) => {
          if (leg.telephonySessionId && leg.partyId) {
            return rcService.hangUpParty(leg.telephonySessionId, leg.partyId);
          }
          return Promise.resolve();
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
      
      // Release extensions
      const extensionIds = job.callLegs.map(leg => leg.holdExtensionId);
      await extensionService.releaseExtensions(extensionIds);
      
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
