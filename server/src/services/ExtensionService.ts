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
      
      for (const ext of data.records) {
        // Check if extension already exists
        const existing = await store.getExtension(ext.id);
        
        // Fetch devices for this extension to get deviceId
        let deviceId: string | undefined;
        if (ext.type === 'User' && ext.status === 'Enabled') {
          try {
            const devicesResponse = await platform.get(`/restapi/v1.0/account/~/extension/${ext.id}/device`);
            const devicesData: any = await devicesResponse.json();
            // Use the first active device
            const activeDevice = devicesData.records?.find((d: any) => 
              d.status === 'Online' && d.useAsCommonPhone === false
            ) || devicesData.records?.[0];
            deviceId = activeDevice?.id;
            
            if (deviceId) {
              logger.debug(`Found device ${deviceId} for extension ${ext.extensionNumber}`);
            }
          } catch (error) {
            logger.debug(`No devices found for extension ${ext.extensionNumber}`);
          }
        }
        
        await store.updateExtension(ext.id, {
          id: ext.id,
          extensionNumber: ext.extensionNumber,
          name: ext.name || 'Unknown',
          department: ext.department || '',
          type: ext.type,
          status: ext.status,
          deviceId, // Store the device ID
          enabledForHunting: existing?.enabledForHunting || false, // Preserve existing setting
          tags: existing?.tags || [],
          currentJobId: existing?.currentJobId,
          lastUsed: existing?.lastUsed
        });
        
        syncedCount++;
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
  async syncExtensionStatus(): Promise<void> {
    const extensions = await store.getAllExtensions();
    
    logger.info('🔄 Syncing real-time extension status from RingCentral...');
    
    let synced = 0;
    let failed = 0;
    
    for (const ext of extensions) {
      try {
        // Check real RingCentral status
        const isAvailable = await rcService.isExtensionAvailable(ext.id);
        const presence = await rcService.getExtensionPresence(ext.id);
        
        // Update Redis with actual status
        await store.updateExtension(ext.id, {
          rcPresenceStatus: presence.presenceStatus,
          rcTelephonyStatus: presence.telephonyStatus,
          isActuallyAvailable: isAvailable,
          lastStatusCheck: new Date().toISOString()
        });
        
        synced++;
      } catch (error: any) {
        failed++;
        logger.debug(`Failed to check status for ext ${ext.extensionNumber}: ${error.message}`);
      }
    }
    
    logger.info(`✅ Extension status sync complete: ${synced} synced, ${failed} failed`);
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
