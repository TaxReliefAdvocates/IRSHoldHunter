import express, { Request, Response } from 'express';
import logger from '../config/logger.js';
import twilioCallingService from '../services/TwilioCallingService.js';
import { store } from '../storage/RedisStore.js';

const router = express.Router();

// POST /api/calls/:callSid/hangup - Hang up a single call
router.post('/:callSid/hangup', async (req: Request, res: Response) => {
  const { callSid } = req.params;
  
  try {
    logger.info(`🔚 Hangup request for call: ${callSid}`);
    
    // Get the call leg
    const leg = await store.getCallLegByTwilioSid(callSid);
    if (!leg) {
      logger.warn(`Call leg not found for SID: ${callSid}`);
      return res.status(404).json({ error: 'Call not found' });
    }
    
    // Hang up via Twilio
    await twilioCallingService.hangUp(callSid);
    
    // Update leg status
    await store.updateCallLeg(leg.id, {
      status: 'ENDED',
      endedAt: new Date().toISOString(),
      lastEventType: 'manual_hangup'
    });
    
    logger.info(`✅ Call ${callSid} hung up successfully`);
    
    res.json({ 
      success: true, 
      message: 'Call hung up',
      callSid 
    });
  } catch (error: any) {
    logger.error(`Failed to hang up call ${callSid}:`, error);
    res.status(500).json({ 
      error: 'Failed to hang up call',
      details: error.message 
    });
  }
});

export default router;
