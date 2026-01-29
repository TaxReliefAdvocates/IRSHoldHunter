import twilio from 'twilio';
import logger from '../config/logger.js';

export class TwilioCallingService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private webhookBaseUrl: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || '';
    
    if (!accountSid || !authToken || !this.fromNumber || !this.webhookBaseUrl) {
      logger.warn('⚠️  Twilio not fully configured');
      return;
    }
    
    this.client = twilio(accountSid, authToken);
    
    logger.info('✅ Twilio calling service initialized');
    logger.info(`   From: ${this.fromNumber}`);
    logger.info(`   Webhook: ${this.webhookBaseUrl}`);
  }

  async initiateCall(toNumber: string, metadata: {
    legId: string;
    jobId: string;
  }): Promise<{ callSid: string }> {
    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    
    try {
      const callFlowUrl = `${this.webhookBaseUrl}/webhooks/twilio/call-flow`;
      const statusCallbackUrl = `${this.webhookBaseUrl}/webhooks/twilio/status`;
      
      logger.info(`📞 Initiating Twilio call to ${toNumber}`);
      logger.info(`   Leg ID: ${metadata.legId}, Job ID: ${metadata.jobId}`);
      logger.info(`   📍 Call Flow URL: ${callFlowUrl}`);
      logger.info(`   📍 Status Callback URL: ${statusCallbackUrl}`);
      
      const callParams = {
        from: this.fromNumber,
        to: toNumber,
        url: callFlowUrl,
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        // NO machineDetection - our AI handles everything!
        timeout: 60,
        record: false
      };
      
      logger.info(`   📋 Call params: ${JSON.stringify(callParams, null, 2)}`);
      
      const call = await this.client.calls.create(callParams);
      
      logger.info(`✅ Call initiated: ${call.sid}`);
      
      return { callSid: call.sid };
      
    } catch (error: any) {
      logger.error('❌ Twilio call failed:', error.message);
      throw new Error(`Twilio call failed: ${error.message}`);
    }
  }

  async sendDTMF(callSid: string, digits: string): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    
    try {
      logger.info(`📱 Sending DTMF '${digits}' to ${callSid}`);
      
      // CRITICAL: Must preserve WebSocket stream when sending DTMF!
      const webhookBase = this.webhookBaseUrl.replace('https://', '').replace('http://', '');
      const wsUrl = `wss://${webhookBase}/websocket/audio`;
      
      await this.client.calls(callSid).update({
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Play digits="${digits}"/>
            <Connect>
              <Stream url="${wsUrl}" track="inbound_track"/>
            </Connect>
            <Pause length="3600"/>
          </Response>`
      });
      
      logger.info(`✅ DTMF sent successfully (stream preserved)`);
      
    } catch (error: any) {
      logger.error('❌ DTMF send failed:', error.message);
      throw error;
    }
  }

  async transferToQueue(callSid: string, queuePhoneNumber: string, extensionNumber?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    
    try {
      logger.info(`🔄 Transferring ${callSid} to ${queuePhoneNumber}${extensionNumber ? ` ext ${extensionNumber}` : ''}`);
      
      // If we have extension but no direct number, use DTMF to dial extension
      const sendDigits = extensionNumber ? `w${extensionNumber}#` : '';
      
      await this.client.calls(callSid).update({
        method: 'POST',
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say>Transferring to agent</Say>
            <Dial timeout="60" timeLimit="14400" callerId="${this.fromNumber}" action="${this.webhookBaseUrl}/webhooks/twilio/dial-status">
              <Number statusCallback="${this.webhookBaseUrl}/webhooks/twilio/dial-callback" statusCallbackEvent="initiated ringing answered completed" sendDigits="${sendDigits}">${queuePhoneNumber}</Number>
            </Dial>
            <Say>The transfer could not be completed. The call has ended.</Say>
            <Hangup/>
          </Response>`
      });
      
      logger.info(`✅ Transfer TwiML sent${sendDigits ? ' (with extension digits)' : ''} - waiting for Dial status...`);
      
    } catch (error: any) {
      logger.error('❌ Transfer failed:', error.message);
      throw error;
    }
  }

  async hangUp(callSid: string): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    
    try {
      logger.info(`📴 Hanging up ${callSid}`);
      
      await this.client.calls(callSid).update({
        status: 'completed'
      });
      
      logger.info(`✅ Call ended`);
      
    } catch (error: any) {
      logger.error('❌ Hangup failed:', error.message);
      throw error;
    }
  }

  async getCallStatus(callSid: string): Promise<any> {
    if (!this.client) {
      throw new Error('Twilio not configured');
    }
    
    const call = await this.client.calls(callSid).fetch();
    return {
      status: call.status,
      duration: call.duration,
      answeredBy: call.answeredBy
    };
  }
}

export const twilioCallingService = new TwilioCallingService();
