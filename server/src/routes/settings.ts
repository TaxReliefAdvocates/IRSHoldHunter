import express, { Request, Response } from 'express';
import logger from '../config/logger.js';
import { store } from '../storage/RedisStore.js';

const router = express.Router();

// GET /api/settings - Get system settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await store.getSystemSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PATCH /api/settings - Update system settings
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { dtmf1Delay, dtmf1Digit, dtmf2Delay, dtmf2Digit } = req.body;
    
    const updates: any = {};
    if (dtmf1Delay !== undefined) updates.dtmf1Delay = parseInt(dtmf1Delay);
    if (dtmf1Digit !== undefined) updates.dtmf1Digit = String(dtmf1Digit);
    if (dtmf2Delay !== undefined) updates.dtmf2Delay = parseInt(dtmf2Delay);
    if (dtmf2Digit !== undefined) updates.dtmf2Digit = String(dtmf2Digit);
    
    const settings = await store.saveSystemSettings(updates);
    logger.info(`✅ System settings updated by user`);
    
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
