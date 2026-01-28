import express, { Request, Response } from 'express';
import logger from '../config/logger.js';
import queueService from '../services/QueueService.js';
import { store } from '../storage/RedisStore.js';

const router = express.Router();

// GET /api/queues - List all queues with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
      search: req.query.search as string
    };
    
    const queues = await queueService.getAvailableQueues(filters);
    res.json(queues);
  } catch (error) {
    logger.error('Failed to list queues:', error);
    res.status(500).json({ error: 'Failed to list queues' });
  }
});

// GET /api/queues/stats - Get queue statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/queues/default - Get default queue
router.get('/default', async (req: Request, res: Response) => {
  try {
    const queue = await store.getDefaultQueue();
    if (!queue) {
      return res.status(404).json({ error: 'No default queue set' });
    }
    res.json(queue);
  } catch (error) {
    logger.error('Failed to get default queue:', error);
    res.status(500).json({ error: 'Failed to get default queue' });
  }
});

// GET /api/queues/:id - Get single queue
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const queue = await store.getQueue(req.params.id);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    res.json(queue);
  } catch (error) {
    logger.error('Failed to get queue:', error);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// POST /api/queues/sync - Sync from RingCentral
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const count = await queueService.syncQueuesFromRC();
    res.json({ 
      success: true, 
      message: `Synced ${count} queues from RingCentral`,
      count 
    });
  } catch (error) {
    logger.error('Failed to sync queues:', error);
    res.status(500).json({ error: 'Failed to sync queues' });
  }
});

// PATCH /api/queues/:id - Update queue config
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const queue = await store.getQueue(req.params.id);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    
    const updates = {
      ...queue,
      ...req.body,
      id: queue.id, // Don't allow changing ID
      phoneNumber: queue.phoneNumber // Don't allow changing phone number
    };
    
    await store.saveQueue(updates);
    res.json(updates);
  } catch (error) {
    logger.error('Failed to update queue:', error);
    res.status(500).json({ error: 'Failed to update queue' });
  }
});

// POST /api/queues/:id/set-default - Set as default queue
router.post('/:id/set-default', async (req: Request, res: Response) => {
  try {
    await store.setDefaultQueue(req.params.id);
    res.json({ success: true, message: 'Default queue updated' });
  } catch (error) {
    logger.error('Failed to set default queue:', error);
    res.status(500).json({ error: 'Failed to set default queue' });
  }
});

// POST /api/queues/:id/tags - Add tag to queue
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({ error: 'tag is required' });
    }
    
    await queueService.addTag(req.params.id, tag);
    res.json({ success: true, message: 'Tag added' });
  } catch (error) {
    logger.error('Failed to add tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// DELETE /api/queues/:id/tags/:tag - Remove tag from queue
router.delete('/:id/tags/:tag', async (req: Request, res: Response) => {
  try {
    await queueService.removeTag(req.params.id, req.params.tag);
    res.json({ success: true, message: 'Tag removed' });
  } catch (error) {
    logger.error('Failed to remove tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// DELETE /api/queues/:id - Delete queue
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await store.deleteQueue(req.params.id);
    res.json({ success: true, message: 'Queue deleted' });
  } catch (error) {
    logger.error('Failed to delete queue:', error);
    res.status(500).json({ error: 'Failed to delete queue' });
  }
});

export default router;
