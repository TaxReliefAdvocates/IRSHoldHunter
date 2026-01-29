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
      
      // Get extension details to find phone number
      const extResponse = await platform.get(`/restapi/v1.0/account/~/extension/${extensionIdStr}`);
      const extData: any = await extResponse.json();
      
      // Get the extension's direct phone number
      const fromPhoneNumber = extData.contact?.businessPhone || 
                             extData.phoneNumbers?.find((p: any) => p.usageType === 'DirectNumber')?.phoneNumber ||
                             extData.phoneNumbers?.find((p: any) => p.usageType === 'MainCompanyNumber')?.phoneNumber;
      
      logger.info(`📞 Starting Call-Out from extension ${extensionIdStr} to ${toPhoneNumber}`);
      logger.debug(`Extension details:`, {
        extensionNumber: extData.extensionNumber,
        name: extData.name,
        directNumber: fromPhoneNumber,
        type: extData.type
      });
      
      // Try Call-Out API with phone number (if available)
      if (fromPhoneNumber) {
        logger.info(`📱 Using direct number: ${fromPhoneNumber}`);
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
        throw new Error(`Extension ${extensionIdStr} (${extData.name}) does not have a direct phone number assigned. Please contact your RingCentral administrator to assign a direct number to this extension.`);
      }
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
      
      logger.info(`📋 Fetching queue details for: ${queueId}`);
      
      // Get from call-queues endpoint first (has more complete data)
      const queueResponse = await platform.get(`/restapi/v1.0/account/~/call-queues/${queueId}`);
      const queueData: any = await queueResponse.json();
      
      // Also get extension details for additional info
      const extResponse = await platform.get(`/restapi/v1.0/account/~/extension/${queueId}`);
      const extData: any = await extResponse.json();
      
      // Get phone numbers from extension's phone-number endpoint (most reliable)
      let phoneNumbers = [];
      try {
        const phoneNumbersResponse = await platform.get(`/restapi/v1.0/account/~/extension/${queueId}/phone-number`);
        const phoneNumbersData: any = await phoneNumbersResponse.json();
        phoneNumbers = phoneNumbersData.records || [];
        logger.info(`📞 Found ${phoneNumbers.length} phone numbers for queue ${queueId}`);
      } catch (error) {
        logger.warn(`Could not fetch phone numbers for queue ${queueId}:`, error);
      }
      
      // Extract phone number - try multiple sources
      let phoneNumber = '';
      
      // 1. Try phone-number endpoint first (most reliable)
      if (phoneNumbers.length > 0) {
        // Log ALL numbers to debug
        logger.info(`📋 ALL ${phoneNumbers.length} numbers:`, phoneNumbers.map((p: any) => 
          `${p.phoneNumber} (${p.usageType}${p.primary ? ', primary' : ''})`
        ));
        
        // Priority search strategy:
        // 1. Look for CallQueue usage type (most reliable)
        // 2. Look for primary number
        // 3. Look for specific area code (949) if user configured it
        // 4. Fallback to DirectNumber or first available
        
        const queueTypeNumber = phoneNumbers.find((p: any) => p.usageType === 'CallQueue');
        const primaryNumber = phoneNumbers.find((p: any) => p.primary === true);
        const number949 = phoneNumbers.find((p: any) => p.phoneNumber.includes('+1949') || p.phoneNumber.includes('949'));
        const directNumber = phoneNumbers.find((p: any) => p.usageType === 'DirectNumber');
        
        // Priority: CallQueue > 949 area code > primary > DirectNumber > first
        const selectedNumber = queueTypeNumber || number949 || primaryNumber || directNumber || phoneNumbers[0];
        phoneNumber = selectedNumber.phoneNumber;
        
        logger.info(`✅ Selected: ${phoneNumber} (type: ${selectedNumber.usageType}, primary: ${!!selectedNumber.primary}, reason: ${
          queueTypeNumber ? 'CallQueue type' : 
          number949 ? '949 area code match' : 
          primaryNumber ? 'Primary flag' : 
          directNumber ? 'DirectNumber type' : 
          'First available'
        })`);
      }
      
      // 2. Fallback to other sources
      if (!phoneNumber) {
        phoneNumber = queueData.phoneNumber || 
                     extData.contact?.businessPhone || 
                     extData.phoneNumbers?.[0]?.phoneNumber ||
                     '';
        if (phoneNumber) {
          logger.info(`✅ Found phone number from fallback: ${phoneNumber}`);
        }
      }
      
      const queueDetails = {
        id: queueData.id || extData.id,
        extensionNumber: queueData.extensionNumber || extData.extensionNumber,
        name: queueData.name || extData.name,
        phoneNumber,
        email: extData.contact?.email || '',
        status: queueData.status || extData.status
      };
      
      // Log what we found (use info level so it's visible)
      logger.info(`📋 Queue "${queueDetails.name}" sync:`, {
        extensionNumber: queueDetails.extensionNumber,
        phoneNumber: queueDetails.phoneNumber || '❌ NO PHONE NUMBER',
        hasDirectLine: !!queueDetails.phoneNumber,
        queueEndpoint: !!queueData.phoneNumber,
        extEndpoint: !!(extData.contact?.businessPhone)
      });
      
      return queueDetails;
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
