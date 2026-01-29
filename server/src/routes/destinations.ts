import express, { Request, Response } from 'express';
import logger from '../config/logger.js';
import destinationService from '../services/DestinationService.js';
import { store, DestinationConfig } from '../storage/RedisStore.js';

const router = express.Router();

// GET /api/destinations - List all destinations with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      activeOnly: req.query.active === 'true',
      tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
      search: req.query.search as string,
      category: req.query.category as string
    };
    
    const destinations = await destinationService.getAvailableDestinations(filters);
    res.json(destinations);
  } catch (error) {
    logger.error('Failed to list destinations:', error);
    res.status(500).json({ error: 'Failed to list destinations' });
  }
});

// GET /api/destinations/stats - Get destination statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await destinationService.getDestinationStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get destination stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/destinations/default - Get default destination
router.get('/default', async (req, res) => {
  try {
    const destination = await store.getDefaultDestination();
    if (!destination) {
      return res.status(404).json({ error: 'No default destination set' });
    }
    res.json(destination);
  } catch (error) {
    logger.error('Failed to get default destination:', error);
    res.status(500).json({ error: 'Failed to get default destination' });
  }
});

// GET /api/destinations/:id - Get single destination
router.get('/:id', async (req, res) => {
  try {
    const destination = await store.getDestination(req.params.id);
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    res.json(destination);
  } catch (error) {
    logger.error('Failed to get destination:', error);
    res.status(500).json({ error: 'Failed to get destination' });
  }
});

// POST /api/destinations - Create destination
router.post('/', async (req, res) => {
  try {
    const { name, phoneNumber, description, category, recommendedLineCount, tags, isDefault, isActive } = req.body;
    
    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'name and phoneNumber are required' });
    }
    
    const destination: DestinationConfig = {
      id: `dest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      phoneNumber,
      description: description || '',
      category: category || 'Other',
      recommendedLineCount: recommendedLineCount || 6,
      isDefault: isDefault || false,
      isActive: isActive !== false, // Default to true
      tags: tags || [],
      createdAt: new Date().toISOString()
    };
    
    await store.saveDestination(destination);
    
    // If set as default, update other destinations
    if (destination.isDefault) {
      await store.setDefaultDestination(destination.id);
    }
    
    res.json(destination);
  } catch (error) {
    logger.error('Failed to create destination:', error);
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

// PATCH /api/destinations/:id - Update destination
router.patch('/:id', async (req, res) => {
  try {
    const destination = await store.getDestination(req.params.id);
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    const updates = {
      ...destination,
      ...req.body,
      id: destination.id, // Don't allow changing ID
      createdAt: destination.createdAt // Don't allow changing createdAt
    };
    
    await store.saveDestination(updates);
    res.json(updates);
  } catch (error) {
    logger.error('Failed to update destination:', error);
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

// POST /api/destinations/:id/set-default - Set as default destination
router.post('/:id/set-default', async (req, res) => {
  try {
    await store.setDefaultDestination(req.params.id);
    res.json({ success: true, message: 'Default destination updated' });
  } catch (error) {
    logger.error('Failed to set default destination:', error);
    res.status(500).json({ error: 'Failed to set default destination' });
  }
});

// POST /api/destinations/:id/tags - Add tag to destination
router.post('/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({ error: 'tag is required' });
    }
    
    await destinationService.addTag(req.params.id, tag);
    res.json({ success: true, message: 'Tag added' });
  } catch (error) {
    logger.error('Failed to add tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// DELETE /api/destinations/:id/tags/:tag - Remove tag from destination
router.delete('/:id/tags/:tag', async (req, res) => {
  try {
    await destinationService.removeTag(req.params.id, req.params.tag);
    res.json({ success: true, message: 'Tag removed' });
  } catch (error) {
    logger.error('Failed to remove tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// DELETE /api/destinations/:id - Delete destination
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await store.deleteDestination(req.params.id);
    res.json({ success: true, message: 'Destination deleted' });
  } catch (error) {
    logger.error('Failed to delete destination:', error);
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

export default router;
