import logger from '../config/logger.js';
import transferService from './TransferService.js';
import liveDetectionService from './LiveDetectionService.js';
import { store } from '../storage/RedisStore.js';
import type { RCWebhookPayload, LegStatus } from '../types/index.js';

class WebhookService {
  async processSessionEvent(payload: RCWebhookPayload): Promise<void> {
    try {
      const { telephonySessionId, parties } = payload.body;
      
      logger.debug(`📨 Processing webhook for session ${telephonySessionId}`);
      
      for (const party of parties) {
        // Find matching call leg
        const leg = await store.findLegBySession(telephonySessionId, party.id);
        
        if (!leg) {
          logger.debug(`No leg found for session ${telephonySessionId}, party ${party.id}`);
          continue;
        }
        
        const previousStatus = leg.status;
        let newStatus = this.mapPartyStatusToLegStatus(party.status.code);
        
        // Store event in history for live detection
        await liveDetectionService.addEvent(leg.id, {
          status: newStatus,
          eventType: party.status.code,
          direction: party.direction,
          previousStatus
        });
        
        // Check if should trigger transfer using smart detection
        const detection = await liveDetectionService.shouldTriggerTransfer(leg);
        
        if (detection.shouldTransfer && leg.status !== 'LIVE' && leg.status !== 'TRANSFERRED') {
          logger.info(`🎯 LIVE DETECTED: Leg ${leg.id} (session ${telephonySessionId})`, {
            confidence: `${(detection.confidence * 100).toFixed(0)}%`,
            reason: detection.reason,
            strategiesPassed: detection.strategiesPassed
          });
          
          // Update status to LIVE
          newStatus = 'LIVE';
          
          // Trigger transfer IMMEDIATELY (non-blocking)
          setImmediate(() => {
            transferService.attemptTransfer(leg.jobId, leg.id).catch((error) => {
              logger.error(`Failed to transfer winning leg ${leg.id}:`, error);
            });
          });
        } else if (!detection.shouldTransfer && previousStatus !== newStatus) {
          logger.debug(`Leg ${leg.id} not ready for transfer:`, detection.reason);
        }
        
        // Update leg status
        const updates: any = {
          status: newStatus,
          lastEventAt: new Date().toISOString(),
          lastEventType: party.status.code,
        };
        
        // Track hold start time
        if (newStatus === 'HOLDING' && !leg.holdStartedAt) {
          updates.holdStartedAt = new Date().toISOString();
        }
        
        // Track live detection time
        if (newStatus === 'LIVE' && !leg.liveDetectedAt) {
          updates.liveDetectedAt = new Date().toISOString();
        }
        
        // Track end time
        if (newStatus === 'ENDED' && !leg.endedAt) {
          updates.endedAt = new Date().toISOString();
        }
        
        await store.updateCallLeg(leg.id, updates);
        
        logger.info(
          `📊 Leg ${leg.id} status: ${previousStatus} → ${newStatus} (party status: ${party.status.code})`
        );
      }
    } catch (error) {
      logger.error('❌ Error processing webhook event:', error);
      throw error;
    }
  }

  private mapPartyStatusToLegStatus(partyCode: string): LegStatus {
    const mapping: Record<string, LegStatus> = {
      Setup: 'DIALING',
      Proceeding: 'RINGING',
      Answered: 'ANSWERED',
      Hold: 'HOLDING',
      Disconnected: 'ENDED',
    };
    
    return mapping[partyCode] || 'ANSWERED';
  }

  validateWebhookToken(validationToken: string): string {
    // RingCentral sends Validation-Token header on first POST
    // Respond with same token to confirm endpoint
    logger.info(`✅ Webhook validation received: ${validationToken}`);
    return validationToken;
  }
}

export default new WebhookService();
