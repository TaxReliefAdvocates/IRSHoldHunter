import { store, DestinationConfig } from '../storage/RedisStore.js';
import logger from '../config/logger.js';

class DestinationService {
  // Get filtered destinations
  async getAvailableDestinations(filters?: {
    activeOnly?: boolean;
    tags?: string[];
    search?: string;
    category?: string;
  }): Promise<DestinationConfig[]> {
    let destinations = await store.getAllDestinations();
    
    if (filters?.activeOnly) {
      destinations = destinations.filter(d => d.isActive);
    }
    
    if (filters?.tags?.length) {
      destinations = destinations.filter(d => 
        filters.tags!.some(tag => d.tags.includes(tag))
      );
    }
    
    if (filters?.category) {
      destinations = destinations.filter(d => d.category === filters.category);
    }
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      destinations = destinations.filter(d =>
        d.name.toLowerCase().includes(search) ||
        d.phoneNumber.includes(search) ||
        d.description?.toLowerCase().includes(search)
      );
    }
    
    // Sort: default first, then alphabetical
    return destinations.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Update destination usage timestamp
  async updateDestinationUsage(destinationId: string): Promise<void> {
    const destination = await store.getDestination(destinationId);
    if (destination) {
      await store.saveDestination({
        ...destination,
        lastUsed: new Date().toISOString()
      });
    }
  }

  // Add tag to destination
  async addTag(destinationId: string, tag: string): Promise<void> {
    const destination = await store.getDestination(destinationId);
    if (!destination) throw new Error(`Destination ${destinationId} not found`);
    
    const tags = destination.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      await store.saveDestination({ ...destination, tags });
    }
  }

  // Remove tag from destination
  async removeTag(destinationId: string, tag: string): Promise<void> {
    const destination = await store.getDestination(destinationId);
    if (!destination) throw new Error(`Destination ${destinationId} not found`);
    
    const tags = (destination.tags || []).filter(t => t !== tag);
    await store.saveDestination({ ...destination, tags });
  }

  // Get destination statistics
  async getDestinationStats(): Promise<{
    total: number;
    active: number;
    default: string | null;
    byCategory: Record<string, number>;
  }> {
    const destinations = await store.getAllDestinations();
    const defaultDestination = await store.getDefaultDestination();
    
    const stats = {
      total: destinations.length,
      active: destinations.filter(d => d.isActive).length,
      default: defaultDestination?.name || null,
      byCategory: {} as Record<string, number>
    };
    
    destinations.forEach(dest => {
      if (dest.category) {
        stats.byCategory[dest.category] = (stats.byCategory[dest.category] || 0) + 1;
      }
    });
    
    return stats;
  }

  // Create default IRS destination if none exist
  async ensureDefaultDestination(): Promise<void> {
    const destinations = await store.getAllDestinations();
    
    if (destinations.length === 0) {
      logger.info('Creating default IRS destination...');
      
      const irsDestination: DestinationConfig = {
        id: `dest_${Date.now()}`,
        name: 'IRS Main Line',
        phoneNumber: process.env.IRS_NUMBER || '+18008291040',
        description: 'IRS Main Phone Line',
        category: 'IRS',
        recommendedLineCount: 6,
        isDefault: true,
        isActive: true,
        tags: ['IRS', 'Government'],
        createdAt: new Date().toISOString()
      };
      
      await store.saveDestination(irsDestination);
      logger.info(`✅ Created default destination: ${irsDestination.name}`);
    }
  }
}

export default new DestinationService();
