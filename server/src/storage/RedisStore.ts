import { Redis } from 'ioredis';
import logger from '../config/logger.js';

const TTL_24H = 86400; // 24 hours in seconds

export type JobStatus = 'CREATED' | 'RUNNING' | 'TRANSFERRED' | 'STOPPED' | 'FAILED';
export type LegStatus = 'DIALING' | 'RINGING' | 'ANSWERED' | 'HOLDING' | 'LIVE' | 'TRANSFERRED' | 'ENDED' | 'FAILED';

export interface Job {
  id: string;
  status: JobStatus;
  irsNumber: string;
  queueNumber: string;
  queueId?: string;
  queueName?: string;
  winningLegId?: string;
  startedAt: string;
  transferredAt?: string;
  stoppedAt?: string;
  lineCount: number;
  poolName?: string;
}

export interface CallLeg {
  id: string;
  jobId: string;
  holdExtensionId: string;
  ringOutId?: string; // For RingOut API
  telephonySessionId?: string;
  partyId?: string;
  status: LegStatus;
  holdStartedAt?: string;
  liveDetectedAt?: string;
  transferredAt?: string;
  endedAt?: string;
  lastEventAt?: string;
  lastEventType?: string;
}

export interface Extension {
  id: string;
  extensionNumber: string;
  name: string;
  department?: string;
  type?: string;
  status?: string;
  deviceId?: string; // Device ID for making outbound calls
  enabledForHunting: boolean;
  tags: string[];
  currentJobId?: string;
  lastUsed?: string;
  rcPresenceStatus?: string;
  rcTelephonyStatus?: string;
  isActuallyAvailable?: boolean;
  lastStatusCheck?: string;
}

export interface QueueConfig {
  id: string;
  name: string;
  phoneNumber: string;
  extensionNumber: string;
  isDefault: boolean;
  tags: string[];
  lastUsed?: string;
}

export interface DestinationConfig {
  id: string;
  name: string;
  phoneNumber: string;
  description?: string;
  category?: string;
  recommendedLineCount?: number;
  isDefault: boolean;
  isActive: boolean;
  tags: string[];
  lastUsed?: string;
  createdAt: string;
}

export interface JobWithLegs extends Job {
  callLegs: CallLeg[];
}

export class RedisStore {
  constructor(public redis: Redis) {}

  // Job operations
  async createJob(data: Omit<Job, 'id' | 'startedAt'>): Promise<Job> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      ...data,
      id,
      startedAt: new Date().toISOString()
    };
    
    await this.redis.setex(`job:${id}`, TTL_24H, JSON.stringify(job));
    await this.redis.sadd('active_jobs', id);
    logger.info(`Job created: ${id}`);
    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const data = await this.redis.get(`job:${jobId}`);
    return data ? JSON.parse(data) : null;
  }

  async getJobWithLegs(jobId: string): Promise<JobWithLegs | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;
    
    const callLegs = await this.getJobLegs(jobId);
    return { ...job, callLegs };
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      logger.warn(`Cannot update job ${jobId} - not found`);
      return;
    }
    const updated = { ...job, ...updates };
    await this.redis.setex(`job:${jobId}`, TTL_24H, JSON.stringify(updated));
    logger.debug(`Job ${jobId} updated:`, updates);
  }

  async getActiveJobs(): Promise<JobWithLegs[]> {
    const jobIds = await this.redis.smembers('active_jobs');
    const jobs = await Promise.all(
      jobIds.map(id => this.getJobWithLegs(id))
    );
    return jobs.filter(j => j !== null) as JobWithLegs[];
  }

  // Call Leg operations
  async createCallLeg(data: Omit<CallLeg, 'id'>): Promise<CallLeg> {
    const id = `leg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const leg: CallLeg = { ...data, id };
    
    await this.redis.setex(`leg:${id}`, TTL_24H, JSON.stringify(leg));
    await this.redis.sadd(`job:${data.jobId}:legs`, id);
    
    logger.debug(`Call leg created: ${id} for job ${data.jobId}`);
    return leg;
  }

  async getCallLeg(legId: string): Promise<CallLeg | null> {
    const data = await this.redis.get(`leg:${legId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateCallLeg(legId: string, updates: Partial<CallLeg>): Promise<void> {
    const leg = await this.getCallLeg(legId);
    if (!leg) {
      logger.warn(`Cannot update leg ${legId} - not found`);
      return;
    }
    const updated = { ...leg, ...updates };
    await this.redis.setex(`leg:${legId}`, TTL_24H, JSON.stringify(updated));
    
    // Update session index if session info provided
    if (updates.telephonySessionId && updates.partyId) {
      await this.redis.setex(
        `session:${updates.telephonySessionId}:${updates.partyId}`,
        TTL_24H,
        legId
      );
    }
    
    logger.debug(`Leg ${legId} updated:`, updates);
  }

  async getJobLegs(jobId: string): Promise<CallLeg[]> {
    const legIds = await this.redis.smembers(`job:${jobId}:legs`);
    const legs = await Promise.all(legIds.map(id => this.getCallLeg(id)));
    return legs.filter(l => l !== null) as CallLeg[];
  }

  async findLegBySession(sessionId: string, partyId: string): Promise<CallLeg | null> {
    // Try index first (fast)
    const legId = await this.redis.get(`session:${sessionId}:${partyId}`);
    if (legId) {
      return await this.getCallLeg(legId);
    }
    
    // Fallback to scan (slower, but works if index missing)
    logger.debug(`Index miss for session ${sessionId}:${partyId}, scanning...`);
    const keys = await this.redis.keys('leg:*');
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;
      const leg: CallLeg = JSON.parse(data);
      if (leg.telephonySessionId === sessionId && leg.partyId === partyId) {
        // Update index for next time
        await this.redis.setex(`session:${sessionId}:${partyId}`, TTL_24H, leg.id);
        logger.debug(`Found leg ${leg.id} via scan, indexed for future`);
        return leg;
      }
    }
    return null;
  }

  // Extension Management
  async getAllExtensions(): Promise<Extension[]> {
    const keys = await this.redis.keys('extension:*');
    const extensions = await Promise.all(
      keys.map(async key => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );
    return extensions.filter(e => e !== null) as Extension[];
  }

  async getExtension(extensionId: string): Promise<Extension | null> {
    const data = await this.redis.get(`extension:${extensionId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateExtension(extensionId: string, updates: Partial<Extension>): Promise<void> {
    const key = `extension:${extensionId}`;
    const existing = await this.redis.get(key);
    const extension = existing ? JSON.parse(existing) : { id: extensionId };
    const updated = { ...extension, ...updates };
    await this.redis.set(key, JSON.stringify(updated));
    logger.debug(`Extension ${extensionId} updated`);
  }

  async getAvailableExtensions(minCount: number): Promise<Extension[]> {
    const all = await this.getAllExtensions();
    return all
      .filter(ext => ext.enabledForHunting && !ext.currentJobId)
      .slice(0, minCount);
  }

  async saveExtensionPool(poolName: string, extensionIds: string[]): Promise<void> {
    await this.redis.set(`extension_pool:${poolName}`, JSON.stringify(extensionIds));
    logger.info(`Extension pool saved: ${poolName} with ${extensionIds.length} extensions`);
  }

  async getExtensionPool(poolName: string): Promise<string[]> {
    const data = await this.redis.get(`extension_pool:${poolName}`);
    return data ? JSON.parse(data) : [];
  }

  async listExtensionPools(): Promise<string[]> {
    const keys = await this.redis.keys('extension_pool:*');
    return keys.map(k => k.replace('extension_pool:', ''));
  }

  async deleteExtensionPool(poolName: string): Promise<void> {
    await this.redis.del(`extension_pool:${poolName}`);
    logger.info(`Extension pool deleted: ${poolName}`);
  }

  // Config operations
  async setConfig(key: string, value: string): Promise<void> {
    await this.redis.set(`config:${key}`, value);
    logger.debug(`Config set: ${key}`);
  }

  async getConfig(key: string): Promise<string | null> {
    return await this.redis.get(`config:${key}`);
  }

  async deleteConfig(key: string): Promise<void> {
    await this.redis.del(`config:${key}`);
    logger.debug(`Config deleted: ${key}`);
  }

  // Winner lock
  async acquireWinnerLock(jobId: string, legId: string): Promise<boolean> {
    const result = await this.redis.set(`job:${jobId}:winner`, legId, 'EX', 60, 'NX');
    return result === 'OK';
  }

  async getWinner(jobId: string): Promise<string | null> {
    return await this.redis.get(`job:${jobId}:winner`);
  }

  async releaseWinnerLock(jobId: string): Promise<void> {
    await this.redis.del(`job:${jobId}:winner`);
  }

  // Event history for live detection
  async getEventHistory(legId: string): Promise<any[]> {
    const eventsJson = await this.redis.get(`leg:${legId}:events`);
    return eventsJson ? JSON.parse(eventsJson) : [];
  }

  async addEvent(legId: string, event: any): Promise<void> {
    const history = await this.getEventHistory(legId);
    history.push({ ...event, timestamp: new Date().toISOString() });
    
    // Keep last 50 events
    if (history.length > 50) history.shift();
    
    await this.redis.setex(`leg:${legId}:events`, TTL_24H, JSON.stringify(history));
  }

  // Queue Management
  async saveQueue(queue: QueueConfig): Promise<void> {
    await this.redis.set(`queue:${queue.id}`, JSON.stringify(queue));
    await this.redis.sadd('queues', queue.id);
    logger.debug(`Queue saved: ${queue.name}`);
  }

  async getQueue(queueId: string): Promise<QueueConfig | null> {
    const data = await this.redis.get(`queue:${queueId}`);
    return data ? JSON.parse(data) : null;
  }

  async getAllQueues(): Promise<QueueConfig[]> {
    const queueIds = await this.redis.smembers('queues');
    const queues = await Promise.all(queueIds.map(id => this.getQueue(id)));
    return queues.filter(q => q !== null) as QueueConfig[];
  }

  async getDefaultQueue(): Promise<QueueConfig | null> {
    const queues = await this.getAllQueues();
    return queues.find(q => q.isDefault) || queues[0] || null;
  }

  async setDefaultQueue(queueId: string): Promise<void> {
    // Clear existing default
    const queues = await this.getAllQueues();
    for (const queue of queues) {
      if (queue.isDefault) {
        await this.saveQueue({ ...queue, isDefault: false });
      }
    }
    
    // Set new default
    const queue = await this.getQueue(queueId);
    if (queue) {
      await this.saveQueue({ ...queue, isDefault: true });
      logger.info(`Default queue set to: ${queue.name}`);
    }
  }

  async deleteQueue(queueId: string): Promise<void> {
    await this.redis.del(`queue:${queueId}`);
    await this.redis.srem('queues', queueId);
    logger.info(`Queue deleted: ${queueId}`);
  }

  // Destination Management
  async saveDestination(destination: DestinationConfig): Promise<void> {
    await this.redis.set(`destination:${destination.id}`, JSON.stringify(destination));
    await this.redis.sadd('destinations', destination.id);
    logger.debug(`Destination saved: ${destination.name}`);
  }

  async getDestination(destinationId: string): Promise<DestinationConfig | null> {
    const data = await this.redis.get(`destination:${destinationId}`);
    return data ? JSON.parse(data) : null;
  }

  async getAllDestinations(): Promise<DestinationConfig[]> {
    const destinationIds = await this.redis.smembers('destinations');
    const destinations = await Promise.all(destinationIds.map(id => this.getDestination(id)));
    return destinations.filter(d => d !== null) as DestinationConfig[];
  }

  async getDefaultDestination(): Promise<DestinationConfig | null> {
    const destinations = await this.getAllDestinations();
    const active = destinations.filter(d => d.isActive);
    return active.find(d => d.isDefault) || active[0] || null;
  }

  async setDefaultDestination(destinationId: string): Promise<void> {
    // Clear existing default
    const destinations = await this.getAllDestinations();
    for (const destination of destinations) {
      if (destination.isDefault) {
        await this.saveDestination({ ...destination, isDefault: false });
      }
    }
    
    // Set new default
    const destination = await this.getDestination(destinationId);
    if (destination) {
      await this.saveDestination({ ...destination, isDefault: true });
      logger.info(`Default destination set to: ${destination.name}`);
    }
  }

  async deleteDestination(destinationId: string): Promise<void> {
    await this.redis.del(`destination:${destinationId}`);
    await this.redis.srem('destinations', destinationId);
    logger.info(`Destination deleted: ${destinationId}`);
  }
}

// Singleton instance
import redis from '../config/redis.js';
export const store = new RedisStore(redis);
