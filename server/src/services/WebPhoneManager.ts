/**
 * Web Phone Manager
 * 
 * Manages multiple RingCentral Web Phone instances for concurrent calling.
 * Each instance acts as a virtual device that can make/receive calls.
 */

import SDK from '@ringcentral/sdk';
import { WebPhone } from 'ringcentral-web-phone';
import logger from '../config/logger.js';

interface WebPhoneInstance {
  extensionId: string;
  extensionNumber: string;
  webPhone: any; // WebPhone instance
  deviceId: string;
  status: 'initializing' | 'ready' | 'busy' | 'error';
}

class WebPhoneManager {
  private instances: Map<string, WebPhoneInstance> = new Map();
  private sdk: SDK;

  constructor(clientId: string, clientSecret: string, serverUrl: string) {
    this.sdk = new SDK({
      server: serverUrl,
      clientId,
      clientSecret,
    });
  }

  /**
   * Initialize a Web Phone instance for an extension
   */
  async initializeWebPhone(
    extensionId: string,
    extensionNumber: string,
    username: string,
    password: string
  ): Promise<string> {
    try {
      logger.info(`🔧 Initializing Web Phone for extension ${extensionNumber}...`);

      // Authenticate as the extension
      const platform = this.sdk.platform();
      await platform.login({
        username,
        password,
      });

      // Create SIP registration
      const sipProvision = await platform
        .post('/restapi/v1.0/client-info/sip-provision', {
          sipInfo: [
            {
              transport: 'WSS',
            },
          ],
        })
        .then((r: any) => r.json());

      // Create Web Phone instance
      const webPhone = new WebPhone(sipProvision, {
        audioHelper: {
          enabled: true, // Enable audio handling
        },
        logLevel: 1, // 0 = error, 1 = warn, 2 = log, 3 = debug
      });

      // Register the web phone
      await webPhone.userAgent.start();

      const deviceId = sipProvision.device.id;

      // Store instance
      this.instances.set(extensionId, {
        extensionId,
        extensionNumber,
        webPhone,
        deviceId,
        status: 'ready',
      });

      logger.info(`✅ Web Phone ready for extension ${extensionNumber}, deviceId: ${deviceId}`);

      return deviceId;
    } catch (error) {
      logger.error(`❌ Failed to initialize Web Phone for extension ${extensionNumber}:`, error);
      throw error;
    }
  }

  /**
   * Make an outbound call using a Web Phone instance
   */
  async makeCall(extensionId: string, toPhoneNumber: string): Promise<{ sessionId: string }> {
    const instance = this.instances.get(extensionId);

    if (!instance) {
      throw new Error(`No Web Phone instance found for extension ${extensionId}`);
    }

    if (instance.status !== 'ready') {
      throw new Error(`Web Phone for extension ${extensionId} is not ready (status: ${instance.status})`);
    }

    try {
      logger.info(`📞 Making call from extension ${instance.extensionNumber} to ${toPhoneNumber}`);

      instance.status = 'busy';

      // Make the call
      const session = instance.webPhone.userAgent.invite(toPhoneNumber, {
        media: {
          render: {
            remote: null, // No remote audio rendering needed for automation
            local: null,  // No local audio rendering needed
          },
        },
      });

      // Wait for call to be established
      await new Promise((resolve, reject) => {
        session.on('accepted', resolve);
        session.on('failed', reject);
        session.on('rejected', reject);

        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Call timeout')), 30000);
      });

      logger.info(`✅ Call established: ${session.id}`);

      return { sessionId: session.id };
    } catch (error) {
      instance.status = 'ready';
      logger.error(`❌ Call failed for extension ${instance.extensionNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get audio stream from active call for hold detection
   */
  getAudioStream(extensionId: string): MediaStream | null {
    const instance = this.instances.get(extensionId);
    if (!instance) return null;

    // Access the remote audio stream
    const session = instance.webPhone.userAgent.activeSession;
    if (!session) return null;

    return session.sessionDescriptionHandler.peerConnection.getRemoteStreams()[0];
  }

  /**
   * Transfer call to queue
   */
  async transferCall(extensionId: string, sessionId: string, queueNumber: string): Promise<void> {
    const instance = this.instances.get(extensionId);
    if (!instance) {
      throw new Error(`No Web Phone instance found for extension ${extensionId}`);
    }

    const session = instance.webPhone.userAgent.activeSession;
    if (!session || session.id !== sessionId) {
      throw new Error(`No active session found for sessionId ${sessionId}`);
    }

    logger.info(`🔄 Transferring call ${sessionId} to ${queueNumber}`);

    await session.transfer(queueNumber);

    instance.status = 'ready';

    logger.info(`✅ Transfer completed`);
  }

  /**
   * Hangup call
   */
  async hangupCall(extensionId: string, sessionId: string): Promise<void> {
    const instance = this.instances.get(extensionId);
    if (!instance) return;

    const session = instance.webPhone.userAgent.activeSession;
    if (session && session.id === sessionId) {
      await session.terminate();
      instance.status = 'ready';
      logger.info(`📞 Call ${sessionId} terminated`);
    }
  }

  /**
   * Get available Web Phone instance
   */
  getAvailableInstance(): WebPhoneInstance | null {
    for (const instance of this.instances.values()) {
      if (instance.status === 'ready') {
        return instance;
      }
    }
    return null;
  }

  /**
   * Shutdown all Web Phone instances
   */
  async shutdown(): Promise<void> {
    logger.info('🔌 Shutting down all Web Phone instances...');

    for (const instance of this.instances.values()) {
      try {
        await instance.webPhone.userAgent.stop();
      } catch (error) {
        logger.error(`Error shutting down Web Phone for extension ${instance.extensionNumber}:`, error);
      }
    }

    this.instances.clear();

    logger.info('✅ All Web Phone instances shut down');
  }
}

export default WebPhoneManager;
