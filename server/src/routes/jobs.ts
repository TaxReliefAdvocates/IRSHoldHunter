import express, { Request, Response } from 'express';
import logger from '../config/logger.js';
import jobService from '../services/JobService.js';
import transferService from '../services/TransferService.js';
import { store } from '../storage/RedisStore.js';
import { io } from '../server.js';
import type { StartJobRequest, StartJobResponse } from '../types/index.js';

const router = express.Router();

// Start a new job
router.post('/start', async (req: Request, res: Response) => {
  try {
    const request = req.body as StartJobRequest;
    
    const jobId = await jobService.startJob(request);
    
    // Notify all clients
    io.emit('job:created', { jobId });
    
    res.json({
      jobId,
      message: 'Job started successfully',
    } as StartJobResponse);
  } catch (error) {
    logger.error('Failed to start job:', error);
    res.status(500).json({
      error: 'Failed to start job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get job details
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const job = await jobService.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(job);
  } catch (error) {
    logger.error('Failed to get job:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

// Stop a job
router.post('/:jobId/stop', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    await jobService.stopJob(jobId);
    
    // Notify all clients
    io.to(`job:${jobId}`).emit('job:stopped', { jobId });
    
    res.json({ message: 'Job stopped successfully' });
  } catch (error) {
    logger.error('Failed to stop job:', error);
    res.status(500).json({ error: 'Failed to stop job' });
  }
});

export default router;
