import express from 'express';
import logger from '../config/logger.js';
import jobService from '../services/JobService.js';
import liveDetectionService from '../services/LiveDetectionService.js';
import transferService from '../services/TransferService.js';
import { store } from '../storage/RedisStore.js';
import { io } from '../server.js';
import type { StartJobRequest, StartJobResponse } from '../types/index.js';

const router = express.Router();

// Start a new job
router.post('/start', async (req, res) => {
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
router.get('/:jobId', async (req, res) => {
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
router.post('/:jobId/stop', async (req, res) => {
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

// POST /api/jobs/:jobId/legs/:legId/confirm-live - Manual confirmation
router.post('/:jobId/legs/:legId/confirm-live', async (req, res) => {
  try {
    const { legId, jobId } = req.params;
    
    logger.info(`📝 Manual live confirmation for leg ${legId} in job ${jobId}`);
    
    // Mark as manually confirmed
    await liveDetectionService.manuallyConfirmLive(legId);
    
    // Update leg status
    await store.updateCallLeg(legId, {
      status: 'LIVE',
      liveDetectedAt: new Date().toISOString()
    });
    
    // Trigger transfer
    await transferService.attemptTransfer(jobId, legId);
    
    // Notify clients
    io.to(`job:${jobId}`).emit('leg:manual_confirm', { legId, jobId });
    
    res.json({ success: true, message: 'Transfer initiated' });
  } catch (error) {
    logger.error('Failed to confirm live:', error);
    res.status(500).json({ error: 'Failed to confirm live' });
  }
});

// GET /api/legs/:legId/detection-status - Get detection status
router.get('/legs/:legId/detection-status', async (req, res) => {
  try {
    const { legId } = req.params;
    
    const status = await liveDetectionService.getDetectionStatus(legId);
    res.json(status);
  } catch (error) {
    logger.error('Failed to get detection status:', error);
    res.status(500).json({ error: 'Failed to get detection status' });
  }
});

export default router;
