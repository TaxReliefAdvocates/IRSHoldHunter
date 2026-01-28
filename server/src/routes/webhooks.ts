import express, { Request, Response } from 'express';
import logger from '../config/logger.js';
import webhookService from '../services/WebhookService.js';
import type { RCWebhookPayload } from '../types/index.js';

const router = express.Router();

// RingCentral webhook endpoint
router.post('/ringcentral', async (req: Request, res: Response) => {
  try {
    // Handle webhook validation
    const validationToken = req.headers['validation-token'] as string;
    if (validationToken) {
      const token = webhookService.validateWebhookToken(validationToken);
      res.setHeader('Validation-Token', token);
      return res.status(200).send();
    }
    
    // Process webhook event
    const payload = req.body as RCWebhookPayload;
    
    logger.debug(`📨 Webhook received: ${payload.event}`, {
      sessionId: payload.body?.telephonySessionId,
    });
    
    // Process asynchronously - don't block webhook response
    setImmediate(() => {
      webhookService.processSessionEvent(payload).catch((error) => {
        logger.error('Failed to process webhook event:', error);
      });
    });
    
    // Respond immediately
    res.status(200).json({ status: 'accepted' });
  } catch (error) {
    logger.error('❌ Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
