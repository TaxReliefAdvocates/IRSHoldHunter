import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import logger from './config/logger.js';
import rcService from './services/RCService.js';
import extensionService from './services/ExtensionService.js';
import jobsRouter from './routes/jobs.js';
import webhooksRouter from './routes/webhooks.js';
import extensionsRouter from './routes/extensions.js';
import queuesRouter from './routes/queues.js';
import destinationsRouter from './routes/destinations.js';
import oauthRouter from './routes/oauth.js';
import destinationService from './services/DestinationService.js';
import { store } from './storage/RedisStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.use('/oauth', oauthRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/extensions', extensionsRouter);
app.use('/api/queues', queuesRouter);
app.use('/api/destinations', destinationsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React build (production only)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await store.getActiveJobs();
    res.json(jobs);
  } catch (error) {
    logger.error('Failed to list jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Socket.io handlers
io.on('connection', (socket) => {
  logger.info(`🔌 Client connected: ${socket.id}`);
  
  socket.on('subscribe:job', (jobId: string) => {
    socket.join(`job:${jobId}`);
    logger.info(`📡 Client ${socket.id} subscribed to job:${jobId}`);
  });
  
  socket.on('unsubscribe:job', (jobId: string) => {
    socket.leave(`job:${jobId}`);
    logger.info(`📡 Client ${socket.id} unsubscribed from job:${jobId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Webhook subscription management
async function ensureWebhookSubscription() {
  try {
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/ringcentral`;
    
    logger.info(`📡 Checking webhook subscription for: ${webhookUrl}`);
    
    // Check existing subscriptions
    const subscriptions = await rcService.listSubscriptions();
    const activeWebhook = subscriptions.find(
      (sub: any) => sub.deliveryMode?.address === webhookUrl && sub.status === 'Active'
    );
    
    if (activeWebhook) {
      logger.info(`✅ Active webhook subscription found: ${activeWebhook.id}`);
      await store.setConfig('webhook_subscription_id', activeWebhook.id);
      return;
    }
    
    // Create new subscription
    logger.info('📡 Creating new webhook subscription...');
    const subscriptionId = await rcService.createWebhookSubscription(webhookUrl);
    
    // Store subscription ID
    await store.setConfig('webhook_subscription_id', subscriptionId);
    
    logger.info(`✅ Webhook subscription created: ${subscriptionId}`);
  } catch (error) {
    logger.error('❌ Failed to ensure webhook subscription:', error);
    logger.warn('⚠️  App will continue, but webhooks may not work without subscription');
  }
}

// Subscription renewal cron (every 24 hours)
async function startSubscriptionRenewal() {
  setInterval(async () => {
    try {
      const subscriptionId = await store.getConfig('webhook_subscription_id');
      
      if (subscriptionId) {
        await rcService.renewSubscription(subscriptionId);
        logger.info('✅ Webhook subscription renewed');
      }
    } catch (error) {
      logger.error('❌ Failed to renew webhook subscription:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}

// Background job to sync extension status periodically
function startStatusSync() {
  // Disabled to avoid RC rate limits - can be manually triggered via API
  // setInterval(async () => {
  //   try {
  //     await extensionService.syncExtensionStatus();
  //   } catch (error) {
  //     logger.debug('Background status sync failed:', error);
  //   }
  // }, 60000); // 60 seconds
  logger.info('ℹ️  Automatic status sync disabled (use manual cleanup button)');
}

// Startup
async function start() {
  try {
    const port = process.env.PORT || 3000;
    
    logger.info('🚀 Starting IRS Hold Hunter...');
    logger.info('🔐 OAuth Mode - Login required via RingCentral');
    
    // Ensure default destination exists (IRS number)
    await destinationService.ensureDefaultDestination();
    
    // Check if we have stored OAuth tokens
    const accessToken = await store.getConfig('rc_access_token');
    const jwtToken = process.env.RC_JWT_TOKEN;
    
    if (accessToken) {
      logger.info('✅ Found stored OAuth tokens - attempting to restore session...');
      
      try {
        // Run startup tasks that require auth
        logger.info('🧹 Running startup cleanup...');
        await extensionService.cleanupStuckExtensions();
        
        // Ensure webhook subscription
        await ensureWebhookSubscription();
        
        // Start subscription renewal
        startSubscriptionRenewal();
      } catch (error) {
        logger.warn('⚠️  Startup tasks failed - tokens may be expired. User should re-login.');
      }
    } else if (jwtToken) {
      logger.info('💡 JWT fallback available - user can skip OAuth for testing');
      
      try {
        // Run startup tasks with JWT
        logger.info('🧹 Running startup cleanup...');
        await extensionService.cleanupStuckExtensions();
        
        await ensureWebhookSubscription();
        startSubscriptionRenewal();
      } catch (error) {
        logger.warn('⚠️  Startup tasks failed with JWT');
      }
    } else {
      logger.info('ℹ️  No authentication found - user needs to login at: http://localhost:3000/oauth/authorize');
    }
    
    // Start periodic status sync
    startStatusSync();
    
    // Start server
    server.listen(port, () => {
      logger.info(`✅ Server running on port ${port}`);
      logger.info(`🔐 OAuth Login: http://localhost:${port}/oauth/authorize`);
      logger.info(`📡 Webhook endpoint: ${process.env.WEBHOOK_BASE_URL}/api/webhooks/ringcentral`);
      logger.info(`🎯 Frontend: ${process.env.CLIENT_URL}`);
      logger.info(`📊 Data retention: ${process.env.DATA_RETENTION_HOURS || 24} hours`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
start();
