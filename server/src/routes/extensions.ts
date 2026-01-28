import express from 'express';
import logger from '../config/logger.js';
import extensionService from '../services/ExtensionService.js';
import { store } from '../storage/RedisStore.js';

const router = express.Router();

// GET /api/extensions - List all extensions with filters
router.get('/', async (req, res) => {
  try {
    const filters = {
      enabledOnly: req.query.enabled === 'true',
      availableOnly: req.query.available === 'true',
      tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
      search: req.query.search as string,
      type: req.query.type as string,
      status: req.query.status as string
    };
    
    const extensions = await extensionService.getFilteredExtensions(filters);
    res.json(extensions);
  } catch (error) {
    logger.error('Failed to list extensions:', error);
    res.status(500).json({ error: 'Failed to list extensions' });
  }
});

// GET /api/extensions/stats - Get extension statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await extensionService.getExtensionStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get extension stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/extensions/pools - List pools (MUST be before /:id route)
router.get('/pools', async (req, res) => {
  try {
    const pools = await store.listExtensionPools();
    res.json(pools);
  } catch (error) {
    logger.error('Failed to list pools:', error);
    res.status(500).json({ error: 'Failed to list pools' });
  }
});

// GET /api/extensions/pools/:name - Get pool extensions
router.get('/pools/:name', async (req, res) => {
  try {
    const extensionIds = await store.getExtensionPool(req.params.name);
    res.json(extensionIds);
  } catch (error) {
    logger.error('Failed to get pool:', error);
    res.status(500).json({ error: 'Failed to get pool' });
  }
});

// POST /api/extensions/cleanup - Clean stuck extensions
router.post('/cleanup', async (req, res) => {
  try {
    const count = await extensionService.cleanupStuckExtensions();
    res.json({ 
      success: true, 
      message: `Cleaned up ${count} stuck extension${count !== 1 ? 's' : ''}`,
      count
    });
  } catch (error: any) {
    logger.error('Failed to cleanup extensions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/extensions/sync-status - Sync real-time status from RingCentral
router.post('/sync-status', async (req, res) => {
  try {
    await extensionService.syncExtensionStatus();
    res.json({ 
      success: true, 
      message: 'Extension status synced from RingCentral' 
    });
  } catch (error: any) {
    logger.error('Failed to sync extension status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/extensions/:id - Get single extension
router.get('/:id', async (req, res) => {
  try {
    const extension = await store.getExtension(req.params.id);
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    res.json(extension);
  } catch (error) {
    logger.error('Failed to get extension:', error);
    res.status(500).json({ error: 'Failed to get extension' });
  }
});

// PATCH /api/extensions/:id - Update extension settings
router.patch('/:id', async (req, res) => {
  try {
    const { enabledForHunting, tags, department } = req.body;
    
    await store.updateExtension(req.params.id, {
      enabledForHunting,
      tags,
      department
    });
    
    res.json({ success: true, message: 'Extension updated' });
  } catch (error) {
    logger.error('Failed to update extension:', error);
    res.status(500).json({ error: 'Failed to update extension' });
  }
});

// POST /api/extensions/bulk-update - Bulk update extensions
router.post('/bulk-update', async (req, res) => {
  try {
    const { extensionIds, updates } = req.body;
    
    if (!Array.isArray(extensionIds) || extensionIds.length === 0) {
      return res.status(400).json({ error: 'extensionIds must be a non-empty array' });
    }
    
    await extensionService.bulkUpdateExtensions(extensionIds, updates);
    
    res.json({ success: true, message: `Updated ${extensionIds.length} extensions` });
  } catch (error) {
    logger.error('Failed to bulk update extensions:', error);
    res.status(500).json({ error: 'Failed to bulk update extensions' });
  }
});

// POST /api/extensions/:id/tags - Add tag to extension
router.post('/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({ error: 'tag is required' });
    }
    
    await extensionService.addTag(req.params.id, tag);
    
    res.json({ success: true, message: 'Tag added' });
  } catch (error) {
    logger.error('Failed to add tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// DELETE /api/extensions/:id/tags/:tag - Remove tag from extension
router.delete('/:id/tags/:tag', async (req, res) => {
  try {
    await extensionService.removeTag(req.params.id, req.params.tag);
    res.json({ success: true, message: 'Tag removed' });
  } catch (error) {
    logger.error('Failed to remove tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// POST /api/extensions/sync - Sync from RingCentral
router.post('/sync', async (req, res) => {
  try {
    const count = await extensionService.syncExtensionsFromRC();
    res.json({ success: true, message: `Synced ${count} extensions from RingCentral` });
  } catch (error) {
    logger.error('Failed to sync extensions:', error);
    res.status(500).json({ error: 'Failed to sync extensions' });
  }
});

// POST /api/extensions/pools - Save extension pool (already have GET above)
router.post('/pools', async (req, res) => {
  try {
    const { name, extensionIds } = req.body;
    
    if (!name || !Array.isArray(extensionIds)) {
      return res.status(400).json({ error: 'name and extensionIds are required' });
    }
    
    await store.saveExtensionPool(name, extensionIds);
    res.json({ success: true, message: `Pool '${name}' saved with ${extensionIds.length} extensions` });
  } catch (error) {
    logger.error('Failed to save pool:', error);
    res.status(500).json({ error: 'Failed to save pool' });
  }
});

// DELETE /api/extensions/pools/:name - Delete pool
router.delete('/pools/:name', async (req, res) => {
  try {
    await store.deleteExtensionPool(req.params.name);
    res.json({ success: true, message: `Pool '${req.params.name}' deleted` });
  } catch (error) {
    logger.error('Failed to delete pool:', error);
    res.status(500).json({ error: 'Failed to delete pool' });
  }
});

export default router;
