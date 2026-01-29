import { store, Extension } from '../storage/RedisStore.js';
import rcService from './RCService.js';
import logger from '../config/logger.js';

class ExtensionService {
  // Sync extensions from RingCentral to Redis
  async syncExtensionsFromRC(): Promise<number> {
    try {
      logger.info('📞 Syncing extensions from RingCentral...');
      
      const platform = await import('../config/ringcentral.js').then(m => m.default.getPlatform());
      const response = await platform.get('/restapi/v1.0/account/~/extension');
      const data: any = await response.json();
      
      let syncedCount = 0;
      
      // Add delay helper to avoid rate limits
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      for (const ext of data.records) {
        // Check if extension already exists
        const existing = await store.getExtension(ext.id);
        
        // Skip device fetch - we don't actually need it since we're using phone numbers
        // This was causing excessive API calls and rate limiting
        
        await store.updateExtension(ext.id, {
          id: ext.id,
          extensionNumber: ext.extensionNumber,
          name: ext.name || 'Unknown',
          department: ext.department || '',
          type: ext.type,
          status: ext.status,
          deviceId: existing?.deviceId, // Preserve existing deviceId if any
          enabledForHunting: existing?.enabledForHunting || false, // Preserve existing setting
          tags: existing?.tags || [],
          currentJobId: existing?.currentJobId,
          lastUsed: existing?.lastUsed
        });
        
        syncedCount++;
        
        // Small delay to avoid rate limits (every 10 extensions)
        if (syncedCount % 10 === 0) {
          await delay(100);
        }
      }
      
      logger.info(`✅ Synced ${syncedCount} extensions from RingCentral`);
      return syncedCount;
    } catch (error) {
      logger.error('❌ Failed to sync extensions from RingCentral:', error);
      throw error;
    }
  }

  // Get filtered extensions based on criteria
  async getFilteredExtensions(filters: {
    enabledOnly?: boolean;
    availableOnly?: boolean;
    extensionNumbers?: string[];
    tags?: string[];
    search?: string;
    type?: string;
    status?: string;
  }): Promise<Extension[]> {
    let extensions = await store.getAllExtensions();
    
    if (filters.enabledOnly) {
      extensions = extensions.filter(e => e.enabledForHunting);
    }
    
    if (filters.availableOnly) {
      extensions = extensions.filter(e => !e.currentJobId);
    }
    
    if (filters.extensionNumbers?.length) {
      extensions = extensions.filter(e => 
        filters.extensionNumbers!.includes(e.extensionNumber)
      );
    }
    
    if (filters.tags?.length) {
      extensions = extensions.filter(e =>
        filters.tags!.some(tag => e.tags?.includes(tag))
      );
    }
    
    if (filters.type) {
      extensions = extensions.filter(e => e.type === filters.type);
    }
    
    if (filters.status) {
      extensions = extensions.filter(e => e.status === filters.status);
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      extensions = extensions.filter(e =>
        e.name?.toLowerCase().includes(search) ||
        e.extensionNumber?.includes(search) ||
        e.department?.toLowerCase().includes(search)
      );
    }
    
    return extensions;
  }

  // Mark extensions as in-use for a job
  async reserveExtensions(extensionIds: string[], jobId: string): Promise<void> {
    logger.info(`Reserving ${extensionIds.length} extensions for job ${jobId}`);
    
    await Promise.all(
      extensionIds.map(id => 
        store.updateExtension(id, { 
          currentJobId: jobId,
          lastUsed: new Date().toISOString()
        })
      )
    );
  }

  // Release extensions when job completes
  async releaseExtensions(extensionIds: string[]): Promise<void> {
    logger.info(`Releasing ${extensionIds.length} extensions`);
    
    await Promise.all(
      extensionIds.map(id => 
        store.updateExtension(id, { currentJobId: undefined })
      )
    );
  }

  // Bulk update extensions
  async bulkUpdateExtensions(
    extensionIds: string[], 
    updates: Partial<Extension>
  ): Promise<void> {
    await Promise.all(
      extensionIds.map(id => store.updateExtension(id, updates))
    );
    
    logger.info(`Bulk updated ${extensionIds.length} extensions`);
  }

  // Add tag to extension
  async addTag(extensionId: string, tag: string): Promise<void> {
    const ext = await store.getExtension(extensionId);
    if (!ext) throw new Error(`Extension ${extensionId} not found`);
    
    const tags = ext.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      await store.updateExtension(extensionId, { tags });
    }
  }

  // Remove tag from extension
  async removeTag(extensionId: string, tag: string): Promise<void> {
    const ext = await store.getExtension(extensionId);
    if (!ext) throw new Error(`Extension ${extensionId} not found`);
    
    const tags = (ext.tags || []).filter(t => t !== tag);
    await store.updateExtension(extensionId, { tags });
  }

  // Get extension statistics
  async getExtensionStats(): Promise<{
    total: number;
    enabled: number;
    available: number;
    inUse: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const extensions = await store.getAllExtensions();
    
    const stats = {
      total: extensions.length,
      enabled: extensions.filter(e => e.enabledForHunting).length,
      available: extensions.filter(e => e.enabledForHunting && !e.currentJobId).length,
      inUse: extensions.filter(e => !!e.currentJobId).length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>
    };
    
    extensions.forEach(ext => {
      if (ext.type) {
        stats.byType[ext.type] = (stats.byType[ext.type] || 0) + 1;
      }
      if (ext.status) {
        stats.byStatus[ext.status] = (stats.byStatus[ext.status] || 0) + 1;
      }
    });
    
    return stats;
  }

  // Sync real-time extension status from RingCentral
  // NOTE: Disabled to avoid rate limits - status checks happen on-demand during job start
  async syncExtensionStatus(): Promise<void> {
    logger.debug('⏭️  Skipping real-time status sync to avoid rate limits');
    // This was causing excessive API calls. Status is now checked only when:
    // 1. Starting a new job (JobService checks availability)
    // 2. User manually syncs extensions
    return;
  }

  // Clean up stuck extensions (extensions marked in-use but job is done)
  async cleanupStuckExtensions(): Promise<number> {
    logger.info('🧹 Cleaning up stuck extensions...');
    
    const extensions = await store.getAllExtensions();
    let cleaned = 0;
    
    for (const ext of extensions) {
      if (ext.currentJobId) {
        // Check if job still exists
        const job = await store.getJob(ext.currentJobId);
        
        if (!job || ['TRANSFERRED', 'STOPPED', 'FAILED'].includes(job.status)) {
          // Job is done but extension wasn't released
          logger.info(`  Releasing stuck extension: ${ext.extensionNumber} (was in job ${ext.currentJobId})`);
          await store.updateExtension(ext.id, { 
            currentJobId: undefined 
          });
          cleaned++;
        }
      }
    }
    
    logger.info(`✅ Cleaned up ${cleaned} stuck extensions`);
    return cleaned;
  }
}

export default new ExtensionService();
