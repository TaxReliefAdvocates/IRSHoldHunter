import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { store, type LegStatus } from '../storage/RedisStore.js';
import { twilioCallingService } from '../services/TwilioCallingService.js';
import { audioHandler } from '../websocket/audioHandler.js';
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
  const { CallSid } = req.body;
  const twiml = new VoiceResponse();
  
  logger.info(`📞 Call flow started for ${CallSid}`);
  
  // STEP 1: Wait for IRS greeting (15 seconds), then press '1'
  const firstDelay = parseInt(process.env.IRS_FIRST_DTMF_DELAY_SECONDS || '15');
  const firstDigit = process.env.IRS_FIRST_DTMF || '1';
  
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
  
  // STEP 2: Start audio streaming immediately
  const webhookBase = process.env.WEBHOOK_BASE_URL!.replace('https://', '').replace('http://', '');
  const wsUrl = `wss://${webhookBase}/websocket/audio`;
  
  logger.info(`🎵 Setting up audio stream for ${CallSid}`);
  logger.info(`   WebSocket URL: ${wsUrl}`);
  
  const connect = twiml.connect();
  connect.stream({
    url: wsUrl,
    track: 'inbound_track'
  });
  
  // STEP 3: Keep call alive
  twiml.pause({ length: 3600 });
  
  // STEP 4: Schedule second DTMF (45 seconds AFTER first DTMF)
  const secondDelay = parseInt(process.env.IRS_SECOND_DTMF_DELAY_SECONDS || '45');
  const secondDigit = process.env.IRS_SECOND_DTMF || '2';
  const totalDelay = firstDelay + secondDelay; // 15 + 45 = 60 seconds total
  
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
  
  res.type('text/xml');
  res.send(twiml.toString());
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
    logger.info(`   Direct phone: ${queue.phoneNumber || 'NONE - will use extension dialing'}`);
    
    // Determine transfer method
    let transferNumber: string;
    let extensionNumber: string | undefined;
    
    if (queue.phoneNumber) {
      // Queue has direct number - dial it directly
      transferNumber = queue.phoneNumber;
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
