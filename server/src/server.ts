import 'dotenv/config';
import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import logger from './config/logger.js';
import rcService from './services/RCService.js';
import jobsRouter from './routes/jobs.js';
import twilioWebhooksRouter from './routes/twilioWebhooks.js';
import extensionsRouter from './routes/extensions.js';
import queuesRouter from './routes/queues.js';
import destinationsRouter from './routes/destinations.js';
import oauthRouter from './routes/oauth.js';
import healthRouter from './routes/health.js';
import destinationService from './services/DestinationService.js';
import { store } from './storage/RedisStore.js';
import { audioHandler } from './websocket/audioHandler.js';
import './queues/dialQueue.js'; // 🔥 CRITICAL: Initialize Bull queue processor

// ===== TWILIO-ONLY MODE =====
// RingCentral is ONLY used for:
// 1. OAuth authentication
// 2. Fetching call queues for transfer destinations
// 3. Receiving transferred calls
//
// NO background polling, NO webhooks, NO extension syncing!
// =========================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize WebSocket support - MUST pass the server instance!
const wsInstance = expressWs(app as any, server as any);

// Initialize Socket.io with hybrid mode (more compatible)
export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow both transports for better compatibility
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  // Reduce ping interval to detect disconnects faster
  pingInterval: 25000,
  pingTimeout: 20000,
  // Limit max payload size
  maxHttpBufferSize: 1e6, // 1 MB
});

// Make io available to audio handler
audioHandler.setIO(io);

// Make io available to routes
app.set('io', io);

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
app.use('/webhooks/twilio', twilioWebhooksRouter);
app.use('/api/extensions', extensionsRouter);
app.use('/api/queues', queuesRouter);
app.use('/api/destinations', destinationsRouter);
app.use('/api/settings', (await import('./routes/settings.js')).default);
app.use('/api/calls', (await import('./routes/calls.js')).default);
app.use('/', healthRouter); // Health check for Render

// WebSocket endpoint for Twilio audio streaming
(app as any).ws('/websocket/audio', (ws: any, req: any) => {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`🎵 Audio WebSocket connection attempt from ${clientIp}`);
  logger.info(`   Headers: ${JSON.stringify(req.headers)}`);
  
  ws.on('open', () => {
    logger.info('🎵 WebSocket connection OPENED');
  });
  
  ws.on('error', (error: any) => {
    logger.error(`❌ WebSocket error: ${error.message}`);
  });
  
  ws.on('close', (code: number, reason: string) => {
    logger.info(`🎵 WebSocket closed - Code: ${code}, Reason: ${reason || 'none'}`);
  });
  
  audioHandler.handleConnection(ws);
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React build (production only)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.get('/api/jobs', async (req: Request, res: Response) => {
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
      logger.info('✅ Found stored OAuth tokens - RingCentral authenticated');
      logger.info('ℹ️  RingCentral is used ONLY for queue transfers (Twilio handles outbound calls)');
    } else if (jwtToken) {
      logger.info('💡 JWT fallback available - user can skip OAuth for testing');
      logger.info('ℹ️  RingCentral is used ONLY for queue transfers (Twilio handles outbound calls)');
    } else {
      logger.info('ℹ️  No authentication found - user needs to login at: http://localhost:3000/oauth/authorize');
    }
    
    // Start server
    server.listen(port, () => {
      logger.info(`✅ Server running on port ${port}`);
      logger.info(`🔐 OAuth Login: http://localhost:${port}/oauth/authorize`);
      logger.info(`📞 Twilio Webhooks: ${process.env.WEBHOOK_BASE_URL}/webhooks/twilio/*`);
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
