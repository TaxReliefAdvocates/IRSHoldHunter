import SDK from '@ringcentral/sdk';
import logger from './logger.js';
import { store } from '../storage/RedisStore.js';

class RingCentralSDK {
  private static instance: SDK | null = null;
  private static isAuthenticated: boolean = false;

  static async getInstance(): Promise<SDK> {
    if (!this.instance) {
      logger.info('🔐 Initializing RingCentral SDK...');
      
      this.instance = new (SDK as any).SDK({
        server: process.env.RC_SERVER_URL || 'https://platform.ringcentral.com',
        clientId: process.env.RC_CLIENT_ID!,
        clientSecret: process.env.RC_CLIENT_SECRET!,
      });

      // Note: Event handlers are on platform(), not SDK instance
      const platform = this.instance!.platform();
      
      // Handle token refresh - save updated tokens to Redis
      (platform as any).on('refreshSuccess', async () => {
        try {
          const authData = await platform.auth().data();
          await store.setConfig('rc_access_token', authData.access_token || '');
          await store.setConfig('rc_refresh_token', authData.refresh_token || '');
          await store.setConfig('rc_token_expiry', (authData.expires_in || 3600).toString());
          await store.setConfig('rc_token_created_at', Date.now().toString());
          logger.info('✅ RingCentral tokens auto-refreshed and saved');
        } catch (error) {
          logger.error('❌ Failed to save refreshed tokens:', error);
        }
      });

      // Handle token refresh errors
      (platform as any).on('refreshError', (error: any) => {
        logger.error('❌ RingCentral token refresh failed - user needs to re-login', error);
        this.isAuthenticated = false;
      });

      // Try to restore tokens from Redis (OAuth flow)
      await this.restoreTokens();
    }

    return this.instance!;
  }

  private static async restoreTokens(): Promise<void> {
    try {
      // Try OAuth tokens first (preferred method)
      const accessToken = await store.getConfig('rc_access_token');
      const refreshToken = await store.getConfig('rc_refresh_token');
      
      if (accessToken && refreshToken) {
        logger.info('🔄 Restoring OAuth tokens from Redis...');
        logger.debug(`Access token: ${accessToken.substring(0, 20)}...`);
        logger.debug(`Refresh token: ${refreshToken ? 'present' : 'MISSING'}`);
        
        const platform = this.instance!.platform();
        await platform.auth().setData({
          access_token: accessToken,
          refresh_token: refreshToken,
          refresh_token_expires_in: '604800', // 7 days
          token_type: 'bearer',
          expires_in: '3600',
          expire_time: Date.now() + 3600000
        });
        
        this.isAuthenticated = true;
        logger.info('✅ OAuth tokens restored successfully');
        
        // Verify tokens work by making a test call
        try {
          const response = await platform.get('/restapi/v1.0/account/~/extension/~');
          const extension: any = await response.json();
          logger.info(`✅ Authenticated as: ${extension.name} (Ext ${extension.extensionNumber})`);
          
          if (extension.permissions?.admin?.enabled) {
            logger.info('🎯 SUPERADMIN DETECTED - Multi-extension calling enabled!');
          }
        } catch (error) {
          logger.warn('⚠️  Stored tokens may be invalid, user needs to re-login');
          logger.error('Token verification error:', error);
          this.isAuthenticated = false;
          
          // Clear invalid tokens
          await store.deleteConfig('rc_access_token');
          await store.deleteConfig('rc_refresh_token');
        }
        return;
      }
      
      logger.info(`ℹ️  No OAuth tokens found (access: ${accessToken ? 'YES' : 'NO'}, refresh: ${refreshToken ? 'YES' : 'NO'})`);
      
      // Fallback to JWT if configured (for testing/development)
      const jwtToken = process.env.RC_JWT_TOKEN;
      if (jwtToken) {
        logger.info('🔑 JWT token found - authenticating with JWT (testing mode)...');
        await this.instance!.login({ jwt: jwtToken });
        this.isAuthenticated = true;
        logger.info('✅ JWT authentication successful');
        return;
      }
      
      // No authentication available
      logger.info('ℹ️  No authentication found - user needs to login via /oauth/authorize');
      this.isAuthenticated = false;
    } catch (error) {
      logger.warn('⚠️  Could not restore authentication:', error);
      this.isAuthenticated = false;
    }
  }

  static async getPlatform() {
    const sdk = await this.getInstance();
    return sdk.platform();
  }
  
  static isReady(): boolean {
    return this.isAuthenticated;
  }
  
  static async requireAuth() {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required - redirect to /oauth/authorize');
    }
  }
}

export default RingCentralSDK;
