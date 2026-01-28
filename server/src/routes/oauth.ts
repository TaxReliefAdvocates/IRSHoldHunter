import express, { Request, Response } from 'express';
import RingCentralSDK from '../config/ringcentral.js';
import { store } from '../storage/RedisStore.js';
import logger from '../config/logger.js';

const router = express.Router();

// Step 1: Initiate OAuth login (doesn't require authentication)
router.get('/authorize', async (req: Request, res: Response) => {
  try {
    // Initialize SDK without authentication just to generate login URL
    const platform = await RingCentralSDK.getPlatform();
    
    const authorizeUri = platform.loginUrl({
      redirectUri: `${process.env.BASE_URL || 'http://localhost:3000'}/oauth/callback`,
      state: 'initial', // CSRF protection
      brandId: '', // Optional
      display: '', // Optional
      prompt: '' // Optional
    });
    
    logger.info('🔐 Redirecting to RingCentral OAuth login...');
    res.redirect(authorizeUri);
  } catch (error: any) {
    logger.error('❌ OAuth authorize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Step 2: Handle OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      throw new Error('No authorization code received');
    }
    
    const redirectUri = `${process.env.BASE_URL || 'http://localhost:3000'}/oauth/callback`;
    
    logger.info('🔐 Received OAuth callback, exchanging code for tokens...');
    logger.info(`   Redirect URI: ${redirectUri}`);
    
    const platform = await RingCentralSDK.getPlatform();
    
    // Exchange authorization code for access token
    await platform.login({
      code: code as string,
      redirect_uri: redirectUri  // Changed from redirectUri to redirect_uri
    });
    
    // Get token data
    const authData: any = await platform.auth().data();
    
    logger.info('📝 Saving OAuth tokens to Redis...');
    logger.debug(`Access token length: ${authData.access_token?.length || 0}`);
    logger.debug(`Refresh token length: ${authData.refresh_token?.length || 0}`);
    
    // Store tokens in Redis (24h TTL, will be refreshed automatically)
    await store.setConfig('rc_access_token', authData.access_token || '');
    await store.setConfig('rc_refresh_token', authData.refresh_token || '');
    await store.setConfig('rc_token_expiry', (authData.expires_in || 3600).toString());
    await store.setConfig('rc_token_created_at', Date.now().toString());
    
    // Verify tokens were saved
    const savedAccessToken = await store.getConfig('rc_access_token');
    const savedRefreshToken = await store.getConfig('rc_refresh_token');
    logger.info(`✅ Tokens saved - Access: ${savedAccessToken ? 'YES' : 'NO'}, Refresh: ${savedRefreshToken ? 'YES' : 'NO'}`);
    
    // Get user info
    const response = await platform.get('/restapi/v1.0/account/~/extension/~');
    const extension: any = await response.json();
    
    await store.setConfig('rc_authenticated_user', JSON.stringify({
      id: extension.id,
      extensionNumber: extension.extensionNumber,
      name: extension.name,
      type: extension.type,
      isAdmin: extension.permissions?.admin?.enabled || false
    }));
    
    // Auto-enable the user's own extension for calling (if it exists in the system)
    try {
      const userExtension = await store.getExtension(extension.id);
      if (userExtension) {
        await store.updateExtension(extension.id, {
          ...userExtension,
          enabledForHunting: true
        });
        logger.info(`✅ Auto-enabled extension ${extension.extensionNumber} for calling`);
      }
    } catch (error) {
      logger.debug('Extension not yet synced, will be enabled on first sync');
    }
    
    logger.info(`✅ OAuth login successful: ${extension.name} (Ext ${extension.extensionNumber})`);
    
    if (extension.permissions?.admin?.enabled) {
      logger.info('🎯 SUPERADMIN DETECTED - Multi-extension calling enabled!');
    } else {
      logger.warn(`⚠️  Regular user - can only call from extension ${extension.extensionNumber}`);
    }
    
    // Redirect to frontend
    res.redirect('http://localhost:5173?auth=success');
  } catch (error: any) {
    logger.error('❌ OAuth callback error:', error);
    res.redirect('http://localhost:5173?auth=error');
  }
});

// Step 3: Check auth status
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Prevent caching of auth status
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const accessToken = await store.getConfig('rc_access_token');
    const userData = await store.getConfig('rc_authenticated_user');
    const jwtToken = process.env.RC_JWT_TOKEN;
    
    // Check OAuth first
    if (accessToken && userData) {
      const user = JSON.parse(userData);
      
      return res.json({
        authenticated: true,
        authMethod: 'oauth',
        user: {
          name: user.name,
          extensionNumber: user.extensionNumber,
          isAdmin: user.isAdmin
        }
      });
    }
    
    // Fallback to JWT if configured (testing mode)
    if (jwtToken) {
      return res.json({
        authenticated: true,
        authMethod: 'jwt',
        user: {
          name: 'JWT User',
          extensionNumber: 'N/A',
          isAdmin: true // JWT typically has full access
        }
      });
    }
    
    // Not authenticated
    res.json({ authenticated: false });
  } catch (error: any) {
    logger.error('❌ OAuth status error:', error);
    res.json({ authenticated: false });
  }
});

// Step 4: Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Revoke token with RingCentral
    try {
      const accessToken = await store.getConfig('rc_access_token');
      if (accessToken) {
        const platform = await RingCentralSDK.getPlatform();
        await platform.logout();
        logger.info('🔓 Token revoked with RingCentral');
      }
    } catch (error) {
      logger.warn('⚠️  Could not revoke token with RingCentral:', error);
    }
    
    // Clear stored tokens
    await store.deleteConfig('rc_access_token');
    await store.deleteConfig('rc_refresh_token');
    await store.deleteConfig('rc_token_expiry');
    await store.deleteConfig('rc_token_created_at');
    await store.deleteConfig('rc_authenticated_user');
    
    logger.info('🔓 User logged out successfully');
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('❌ OAuth logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
