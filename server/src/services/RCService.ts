import RingCentralSDK from '../config/ringcentral.js';
import logger from '../config/logger.js';
import type { RCCallOutResponse } from '../types/index.js';

interface ExtensionPresence {
  presenceStatus: string;
  telephonyStatus: string;
  userStatus: string;
}

class RCService {
  /**
   * Initiate outbound call using Call-Out API with phone number
   * Tries multiple approaches to find a working calling method
   */
  async initiatePlaceCall(
    fromExtensionId: string,
    toPhoneNumber: string
  ): Promise<{ sessionId: string; partyId: string }> {
    const extensionIdStr = String(fromExtensionId);
    
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      // Get extension details
      const extResponse = await platform.get(`/restapi/v1.0/account/~/extension/${extensionIdStr}`);
      const extData: any = await extResponse.json();
      
      logger.info(`📞 Starting Call-Out from extension ${extensionIdStr} to ${toPhoneNumber}`);
      logger.debug(`Extension details:`, {
        extensionNumber: extData.extensionNumber,
        name: extData.name,
        type: extData.type
      });
      
      // Try approach 1: Get device ID (preferred for SoftPhone)
      let deviceId: string | undefined;
      logger.info('🔍 Approach 1: Checking for online devices...');
      try {
        const devicesResponse = await platform.get(`/restapi/v1.0/account/~/extension/${extensionIdStr}/device`);
        const devicesData: any = await devicesResponse.json();
        logger.debug(`Found ${devicesData.records?.length || 0} devices for extension ${extensionIdStr}`);
        
        const onlineDevice = devicesData.records?.find((d: any) => d.status === 'Online');
        deviceId = onlineDevice?.id;
        
        if (deviceId) {
          logger.info(`✅ Found online device ID: ${deviceId} (${onlineDevice.type})`);
          const response = await platform.post(
            '/restapi/v1.0/account/~/telephony/call-out',
            {
              from: { deviceId },
              to: { phoneNumber: toPhoneNumber }
            }
          );
          
          const data: any = await response.json();
          const outboundParty = data.parties?.find((p: any) => p.direction === 'Outbound');
          
          if (!outboundParty) {
            throw new Error('No outbound party found in Call-Out response');
          }
          
          logger.info(`✅ Call-Out initiated: sessionId=${data.sessionId}, partyId=${outboundParty.id}`);
          
          return {
            sessionId: data.sessionId,
            partyId: outboundParty.id
          };
        } else {
          logger.info('⚠️ No online devices found');
        }
      } catch (deviceError: any) {
        logger.warn(`Device approach failed: ${deviceError.message}`);
      }
      
      // Try approach 2: Get phone number from account-level phone-number endpoint
      logger.info('🔍 Approach 2: Looking up direct phone number...');
      try {
        const phoneResponse = await platform.get(`/restapi/v1.0/account/~/phone-number?perPage=100`);
        const phoneData: any = await phoneResponse.json();
        logger.debug(`Found ${phoneData.records?.length || 0} total phone numbers in account`);
        
        const extensionNumbers = phoneData.records?.filter((p: any) => 
          String(p.extension?.id) === String(extensionIdStr) && p.usageType === 'DirectNumber'
        );
        
        logger.debug(`Found ${extensionNumbers?.length || 0} DirectNumbers for extension ${extensionIdStr}`);
        
        if (extensionNumbers && extensionNumbers.length > 0) {
          const fromPhoneNumber = extensionNumbers[0].phoneNumber;
          logger.info(`✅ Found direct number: ${fromPhoneNumber}`);
          
          const response = await platform.post(
            '/restapi/v1.0/account/~/telephony/call-out',
            {
              from: { phoneNumber: fromPhoneNumber },
              to: { phoneNumber: toPhoneNumber }
            }
          );
          
          const data: any = await response.json();
          const outboundParty = data.parties?.find((p: any) => p.direction === 'Outbound');
          
          if (!outboundParty) {
            throw new Error('No outbound party found in Call-Out response');
          }
          
          logger.info(`✅ Call-Out initiated: sessionId=${data.sessionId}, partyId=${outboundParty.id}`);
          
          return {
            sessionId: data.sessionId,
            partyId: outboundParty.id
          };
        } else {
          logger.warn(`⚠️ No DirectNumbers found for extension ${extensionIdStr}`);
        }
      } catch (phoneError: any) {
        logger.error(`Phone number approach failed: ${phoneError.message}`, phoneError);
      }
      
      // If both approaches failed, provide clear error message
      throw new Error(
        `Extension ${extensionIdStr} (${extData.name}) cannot initiate calls.\n\n` +
        `ISSUE: Call-Out API requires an ONLINE device (deviceId), but:\n` +
        `  • No devices are online for this extension\n` +
        `  • Call-Out API rejects phoneNumber/extensionNumber in "from" field\n\n` +
        `SOLUTION: Keep RingCentral Phone app running and logged in for extension ${extData.extensionNumber}.\n\n` +
        `For multiple concurrent calls, you need multiple devices online OR use a different approach.`
      );
      
    } catch (error: any) {
      const errorDetails = error.response ? await error.response.json().catch(() => ({})) : {};
      logger.error(`❌ Failed to initiate Call-Out from extension ${extensionIdStr} to ${toPhoneNumber}`, {
        message: error.message,
        errorCode: errorDetails.errorCode,
        errorMessage: errorDetails.message,
        request: { 
          extensionId: extensionIdStr,
          toNumber: toPhoneNumber
        }
      });
      throw error;
    }
  }

  async transferToQueue(
    sessionId: string,
    partyId: string,
    queueNumber: string
  ): Promise<void> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      logger.info(`🔄 Transferring call ${sessionId}/${partyId} to queue ${queueNumber}`);
      
      await platform.post(
        `/restapi/v1.0/account/~/telephony/sessions/${sessionId}/parties/${partyId}/transfer`,
        { phoneNumber: queueNumber }
      );
      
      logger.info(`✅ Transfer completed successfully`);
    } catch (error) {
      logger.error(`❌ Transfer failed for ${sessionId}/${partyId}:`, error);
      throw error;
    }
  }

  async hangUpParty(sessionId: string, partyId: string): Promise<void> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      logger.info(`📴 Hanging up call ${sessionId}/${partyId}`);
      
      await platform.delete(
        `/restapi/v1.0/account/~/telephony/sessions/${sessionId}/parties/${partyId}`
      );
      
      logger.info(`✅ Hang up successful`);
    } catch (error) {
      logger.error(`❌ Hang up failed for ${sessionId}/${partyId}:`, error);
      // Don't throw - call might already be disconnected
    }
  }

  async createWebhookSubscription(webhookUrl: string): Promise<string> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      logger.info(`🔔 Creating webhook subscription for ${webhookUrl}`);
      
      const response = await platform.post('/restapi/v1.0/subscription', {
        eventFilters: ['/restapi/v1.0/account/~/telephony/sessions'],
        deliveryMode: {
          transportType: 'WebHook',
          address: webhookUrl,
        },
        expiresIn: 604800, // 7 days
      });
      
      const data: any = await response.json();
      
      logger.info(`✅ Webhook subscription created: ${data.id}`);
      
      return data.id;
    } catch (error) {
      logger.error('❌ Failed to create webhook subscription:', error);
      throw error;
    }
  }

  async renewSubscription(subscriptionId: string): Promise<void> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      logger.info(`🔄 Renewing subscription ${subscriptionId}`);
      
      await platform.post(`/restapi/v1.0/subscription/${subscriptionId}/renew`);
      
      logger.info(`✅ Subscription renewed successfully`);
    } catch (error) {
      logger.error(`❌ Failed to renew subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async listSubscriptions(): Promise<any[]> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      const response = await platform.get('/restapi/v1.0/subscription');
      const data: any = await response.json();
      return data.records || [];
    } catch (error) {
      logger.error('❌ Failed to list subscriptions:', error);
      return [];
    }
  }

  // Call Queue Management
  async listCallQueues(): Promise<any[]> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      logger.debug('📋 Fetching call queues from RingCentral');
      
      const response = await platform.get('/restapi/v1.0/account/~/call-queues');
      const data: any = await response.json();
      
      return data.records || [];
    } catch (error) {
      logger.error('❌ Failed to list call queues:', error);
      throw error;
    }
  }

  async getQueueDetails(queueId: string): Promise<any> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      
      logger.debug(`📋 Fetching details for queue: ${queueId}`);
      
      const response = await platform.get(`/restapi/v1.0/account/~/extension/${queueId}`);
      const data: any = await response.json();
      
      return {
        id: data.id,
        extensionNumber: data.extensionNumber,
        name: data.name,
        phoneNumber: data.contact?.businessPhone || '',
        email: data.contact?.email || '',
        status: data.status
      };
    } catch (error) {
      logger.error(`❌ Failed to get queue details for ${queueId}:`, error);
      throw error;
    }
  }

  async getExtensionPresence(extensionId: string): Promise<{
    presenceStatus: string;
    telephonyStatus: string;
    userStatus: string;
  }> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      const extensionIdStr = String(extensionId);
      const response = await platform.get(
        `/restapi/v1.0/account/~/extension/${extensionIdStr}/presence`
      );
      const data: any = await response.json();
      return {
        presenceStatus: data.presenceStatus,
        telephonyStatus: data.telephonyStatus,
        userStatus: data.userStatus
      };
    } catch (error) {
      logger.error(`Failed to get presence for extension ${extensionId}:`, error);
      throw error;
    }
  }

  async getActiveCallsForExtension(extensionId: string): Promise<any[]> {
    try {
      const platform = await RingCentralSDK.getPlatform();
      const extensionIdStr = String(extensionId);
      const response = await platform.get(
        `/restapi/v1.0/account/~/extension/${extensionIdStr}/active-calls`
      );
      const data: any = await response.json();
      return data.records || [];
    } catch (error) {
      logger.debug(`Failed to get active calls for extension ${extensionId}:`, error);
      return [];
    }
  }

  async isExtensionAvailable(extensionId: string): Promise<boolean> {
    try {
      const presence = await this.getExtensionPresence(extensionId);
      const activeCalls = await this.getActiveCallsForExtension(extensionId);
      
      return activeCalls.length === 0 && presence.telephonyStatus === 'NoCall';
    } catch (error) {
      logger.debug(`Could not check availability for extension ${extensionId}, assuming unavailable`);
      return false;
    }
  }
}

export default new RCService();
