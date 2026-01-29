import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { store, type LegStatus } from '../storage/RedisStore.js';
import { twilioCallingService } from '../services/TwilioCallingService.js';
import { audioHandler } from '../websocket/audioHandler.js';
import rcService from '../services/RCService.js';
import logger from '../config/logger.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// Dial status callback - tells us what happened with the transfer
router.post('/dial-status', async (req: Request, res: Response) => {
  const { CallSid, DialCallStatus, DialCallSid, DialCallDuration } = req.body;
  
  logger.info(`📞 Dial Status for ${CallSid}:`, {
    status: DialCallStatus,
    dialledCallSid: DialCallSid,
    duration: DialCallDuration
  });
  
  // Continue the call or hang up based on status
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Transfer ${DialCallStatus}. Goodbye.</Say>
      <Hangup/>
    </Response>`);
});

// Dial callback - real-time status of the dialed leg
router.post('/dial-callback', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, ParentCallSid } = req.body;
  
  logger.info(`🔔 Dial Callback - Parent: ${ParentCallSid}, Dialed: ${CallSid}, Status: ${CallStatus}`);
  
  res.sendStatus(200);
});


// Main call flow handler - IRS sequence
router.post('/call-flow', async (req: Request, res: Response) => {
  try {
    const { CallSid } = req.body;
    const twiml = new VoiceResponse();
    
    logger.info(`📞 Call flow webhook received for ${CallSid || 'UNKNOWN'}`);
    logger.info(`📋 Request body: ${JSON.stringify(req.body)}`);
    
    if (!CallSid) {
      logger.error('❌ No CallSid in request body!');
      return res.status(400).send('Missing CallSid');
    }
    
    logger.info(`✅ Call flow started for ${CallSid}`);
    
    // STEP 1: Start audio streaming immediately
    const webhookBase = process.env.WEBHOOK_BASE_URL!.replace('https://', '').replace('http://', '');
    const wsUrl = `wss://${webhookBase}/websocket/audio`;
    
    logger.info(`🎵 Setting up audio stream for ${CallSid}`);
    logger.info(`   WebSocket URL: ${wsUrl}`);
    
    const connect = twiml.connect();
    connect.stream({
      url: wsUrl,
      track: 'inbound_track'
    });
    
    // STEP 2: Keep call alive
    twiml.pause({ length: 3600 });
    
    // Send TwiML response immediately (don't block on Redis/DB)
    res.type('text/xml');
    res.send(twiml.toString());
    
    logger.info(`✅ TwiML response sent for ${CallSid}`);
    
    // STEP 3: Get settings and schedule DTMF in background
    setImmediate(async () => {
    try {
      // Get DTMF settings from Redis (or fall back to env vars)
      const settings = await store.getSystemSettings();
      const firstDelay = settings.dtmf1Delay;
      const firstDigit = settings.dtmf1Digit;
      const secondDelay = settings.dtmf2Delay;
      const secondDigit = settings.dtmf2Digit;
      const totalDelay = firstDelay + secondDelay;
      
      logger.info(`⚙️  DTMF Settings: '${firstDigit}' at ${firstDelay}s, '${secondDigit}' at ${totalDelay}s total`);
      
      // Schedule first DTMF
      setTimeout(async () => {
        try {
          logger.info(`⏰ ${firstDelay}s elapsed, pressing '${firstDigit}' on ${CallSid}`);
          await twilioCallingService.sendDTMF(CallSid, firstDigit);
          
          const leg = await store.getCallLegByTwilioSid(CallSid);
          if (leg) {
            await store.updateCallLeg(leg.id, {
              lastEventAt: new Date().toISOString(),
              lastEventType: 'dtmf_1_sent'
            });
            
            // Notify audio handler for logging
            await audioHandler.notifyDtmf1Sent(CallSid);
          }
        } catch (error) {
          logger.error(`Failed to send DTMF 1:`, error);
        }
      }, firstDelay * 1000);
      
      // Schedule second DTMF
      setTimeout(async () => {
        try {
          logger.info(`⏰ ${totalDelay}s elapsed (${secondDelay}s after DTMF 1), pressing '${secondDigit}' on ${CallSid}`);
          await twilioCallingService.sendDTMF(CallSid, secondDigit);
          
          const leg = await store.getCallLegByTwilioSid(CallSid);
          if (leg) {
            await store.updateCallLeg(leg.id, {
              lastEventAt: new Date().toISOString(),
              lastEventType: 'dtmf_2_sent'
            });
            
            // Notify audio handler
            audioHandler.notifyDtmf2Sent(CallSid);
          }
        } catch (error) {
          logger.error(`Failed to send DTMF 2:`, error);
        }
      }, totalDelay * 1000);
      
      // Update status to ANSWERED
      const leg = await store.getCallLegByTwilioSid(CallSid);
      if (leg) {
        await store.updateCallLeg(leg.id, {
          status: 'ANSWERED',
          holdStartedAt: new Date().toISOString(),
          lastEventAt: new Date().toISOString(),
          lastEventType: 'call-flow-started'
        });
        
        // Emit socket update
        const io = (req.app as any).get('io');
        if (io) {
          io.to(`job:${leg.jobId}`).emit('leg-update', {
            legId: leg.id,
            status: 'ANSWERED'
          });
        }
      }
    } catch (error) {
      logger.error('Failed to setup call flow:', error);
    }
  });
  } catch (error) {
    logger.error(`❌ Call flow error for ${req.body?.CallSid}:`, error);
    res.status(500).send('Internal error');
  }
});

// Status callback - track call state
router.post('/status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, AnsweredBy } = req.body;
  
  logger.info(`📞 Call status: ${CallSid} → ${CallStatus}`);
  
  if (AnsweredBy) {
    logger.info(`🤖 AMD Detection: ${CallSid} → ${AnsweredBy}`);
  }
  
  try {
    const leg = await store.getCallLegByTwilioSid(CallSid);
    if (!leg) {
      logger.warn(`No leg found for call ${CallSid}`);
      return res.sendStatus(200);
    }
    
    // Voicemail detection
    if (AnsweredBy && (AnsweredBy.includes('machine') || AnsweredBy.includes('beep'))) {
      logger.info(`🤖 VOICEMAIL DETECTED, hanging up ${CallSid}`);
      await store.updateCallLeg(leg.id, { 
        status: 'FAILED',
        lastEventType: 'voicemail',
        endedAt: new Date().toISOString()
      });
      await twilioCallingService.hangUp(CallSid);
      return res.sendStatus(200);
    }
    
    // Map status
    const statusMap: Record<string, LegStatus> = {
      'initiated': 'DIALING',
      'ringing': 'RINGING',
      'in-progress': 'ANSWERED',
      'completed': 'ENDED',
      'busy': 'FAILED',
      'no-answer': 'FAILED',
      'canceled': 'ENDED',
      'failed': 'FAILED'
    };
    
    const newStatus: LegStatus = statusMap[CallStatus] || leg.status;
    
    await store.updateCallLeg(leg.id, {
      status: newStatus,
      lastEventAt: new Date().toISOString(),
      lastEventType: CallStatus
    });
    
    // Mark hold start
    if (CallStatus === 'in-progress' && !leg.holdStartedAt) {
      await store.updateCallLeg(leg.id, {
        holdStartedAt: new Date().toISOString()
      });
    }
    
    // Emit update
    const io = (req.app as any).get('io');
    if (io) {
      io.to(`job:${leg.jobId}`).emit('leg-update', {
        legId: leg.id,
        status: newStatus
      });
    }
    
    res.sendStatus(200);
    
  } catch (error: any) {
    logger.error('Error processing status:', error);
    res.sendStatus(500);
  }
});

// Manual transfer endpoint
router.post('/trigger-transfer/:callSid', async (req: Request, res: Response) => {
  const { callSid } = req.params;
  
  try {
    logger.info(`🎯 Manual transfer request for call: ${callSid}`);
    
    const leg = await store.getCallLegByTwilioSid(callSid);
    if (!leg) {
      logger.error(`❌ Call leg not found for SID: ${callSid}`);
      return res.status(404).json({ error: 'Call not found' });
    }
    
    logger.info(`   Found leg: ${leg.id}, job: ${leg.jobId}`);
    
    const job = await store.getJob(leg.jobId);
    if (!job) {
      logger.error(`❌ Job not found: ${leg.jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }
    
    logger.info(`   Job queue ID: ${job.queueId || 'none'}`);
    
    const queue = await store.getQueue(job.queueId || 'queue-main');
    if (!queue) {
      logger.error(`❌ Queue not found: ${job.queueId}`);
      return res.status(400).json({ error: 'Queue not found' });
    }
    
    logger.info(`   Queue: "${queue.name}" (${queue.extensionNumber})`);
    logger.info(`   Configured phone: ${queue.phoneNumber || 'NONE'}`);
    
    let phoneNumber = queue.phoneNumber; // Use configured number first
    
    // If no phone number configured, try to fetch from RingCentral
    if (!phoneNumber) {
      logger.info(`🔄 No phone number configured, fetching from RingCentral...`);
      try {
        const freshQueueDetails = await rcService.getQueueDetails(queue.id);
        phoneNumber = freshQueueDetails.phoneNumber;
        
        if (phoneNumber) {
          logger.info(`✅ Found phone number from RingCentral: ${phoneNumber}`);
          // Update cache for future use
          await store.saveQueue({ ...queue, phoneNumber });
        } else {
          logger.warn(`⚠️  No phone number found from RingCentral`);
        }
      } catch (error) {
        logger.error(`Failed to fetch queue details from RingCentral:`, error);
      }
    } else {
      logger.info(`✅ Using configured phone number: ${phoneNumber}`);
    }
    
    // Determine transfer method
    let transferNumber: string;
    let extensionNumber: string | undefined;
    
    if (phoneNumber) {
      // Queue has direct number - dial it directly
      transferNumber = phoneNumber;
      logger.info(`🎯 Using direct number: ${transferNumber}`);
    } else if (queue.extensionNumber) {
      // No direct number - use RingCentral main number + extension
      const rcMainNumber = process.env.RC_MAIN_NUMBER;
      if (!rcMainNumber) {
        logger.error(`❌ Queue has no direct number and RC_MAIN_NUMBER not configured`);
        return res.status(400).json({ 
          error: `Queue "${queue.name}" has no direct number. Add RC_MAIN_NUMBER to .env for extension dialing.`,
          queueName: queue.name,
          extensionNumber: queue.extensionNumber
        });
      }
      transferNumber = rcMainNumber;
      extensionNumber = queue.extensionNumber;
      logger.info(`🎯 Using extension dialing: ${transferNumber} ext ${extensionNumber}`);
    } else {
      logger.error(`❌ Queue "${queue.name}" has no phone number or extension`);
      return res.status(400).json({ 
        error: `Queue "${queue.name}" has no phone number or extension configured.`,
        queueName: queue.name
      });
    }
    
    logger.info(`🎯 Initiating transfer...`);
    
    await store.updateCallLeg(leg.id, {
      status: 'LIVE',
      liveDetectedAt: new Date().toISOString()
    });
    
    await twilioCallingService.transferToQueue(callSid, transferNumber, extensionNumber);
    
    await store.updateJob(job.id, {
      status: 'TRANSFERRED',
      transferredAt: new Date().toISOString(),
      winningLegId: leg.id
    });
    
    // 🔥 DO NOT hang up other legs - user wants to transfer ALL live agents!
    logger.info(`✅ Manual transfer complete - other calls can continue`);
    
    res.json({ success: true });
    
  } catch (error: any) {
    logger.error('Manual transfer failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
