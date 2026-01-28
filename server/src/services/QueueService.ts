import { store, QueueConfig } from '../storage/RedisStore.js';
import rcService from './RCService.js';
import logger from '../config/logger.js';

class QueueService {
  // Sync queues from RingCentral to Redis
  async syncQueuesFromRC(): Promise<number> {
    try {
      logger.info('📞 Syncing call queues from RingCentral...');
      
      const rcQueues = await rcService.listCallQueues();
      let syncedCount = 0;
      
      for (const queue of rcQueues) {
        try {
          // Get full details including phone number
          const details = await rcService.getQueueDetails(queue.id);
          
          // Check if already exists
          const existing = await store.getQueue(queue.id);
          
          await store.saveQueue({
            id: details.id,
            name: details.name,
            phoneNumber: details.phoneNumber,
            extensionNumber: details.extensionNumber,
            isDefault: existing?.isDefault || false,
            tags: existing?.tags || [],
            lastUsed: existing?.lastUsed
          });
          
          syncedCount++;
        } catch (error) {
          logger.warn(`Failed to sync queue ${queue.id}:`, error);
        }
      }
      
      logger.info(`✅ Synced ${syncedCount} call queues from RingCentral`);
      return syncedCount;
    } catch (error) {
      logger.error('❌ Failed to sync queues from RingCentral:', error);
      throw error;
    }
  }

  // Get filtered queues
  async getAvailableQueues(filters?: {
    tags?: string[];
    search?: string;
  }): Promise<QueueConfig[]> {
    let queues = await store.getAllQueues();
    
    if (filters?.tags?.length) {
      queues = queues.filter(q => 
        filters.tags!.some(tag => q.tags.includes(tag))
      );
    }
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      queues = queues.filter(q =>
        q.name.toLowerCase().includes(search) ||
        q.extensionNumber.includes(search) ||
        q.phoneNumber.includes(search)
      );
    }
    
    // Sort: default first, then alphabetical
    return queues.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Update queue usage timestamp
  async updateQueueUsage(queueId: string): Promise<void> {
    const queue = await store.getQueue(queueId);
    if (queue) {
      await store.saveQueue({
        ...queue,
        lastUsed: new Date().toISOString()
      });
    }
  }

  // Add tag to queue
  async addTag(queueId: string, tag: string): Promise<void> {
    const queue = await store.getQueue(queueId);
    if (!queue) throw new Error(`Queue ${queueId} not found`);
    
    const tags = queue.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      await store.saveQueue({ ...queue, tags });
    }
  }

  // Remove tag from queue
  async removeTag(queueId: string, tag: string): Promise<void> {
    const queue = await store.getQueue(queueId);
    if (!queue) throw new Error(`Queue ${queueId} not found`);
    
    const tags = (queue.tags || []).filter(t => t !== tag);
    await store.saveQueue({ ...queue, tags });
  }

  // Get queue statistics
  async getQueueStats(): Promise<{
    total: number;
    withPhoneNumber: number;
    default: string | null;
  }> {
    const queues = await store.getAllQueues();
    const defaultQueue = await store.getDefaultQueue();
    
    return {
      total: queues.length,
      withPhoneNumber: queues.filter(q => q.phoneNumber).length,
      default: defaultQueue?.name || null
    };
  }
}

export default new QueueService();
