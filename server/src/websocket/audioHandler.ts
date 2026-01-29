import WebSocket from 'ws';
import { store } from '../storage/RedisStore.js';
import { twilioCallingService } from '../services/TwilioCallingService.js';
import { liveAgentDetector } from '../services/LiveAgentDetector.js';
import logger from '../config/logger.js';

interface AudioAnalysis {
  energy: number;
  variance: number;
  timestamp: number;
}

interface StreamConnection {
  ws: WebSocket;
  callSid: string;
  audioBuffer: Buffer[];
  analysisHistory: AudioAnalysis[];
  
  callAnsweredAt: number;
  dtmf2SentAt?: number;
  
  tooBusyDetected: boolean;
  holdMusicDetected: boolean;
  holdMusicStoppedAt?: number;
  liveAgentConfidence: number;
  
  transferTriggered: boolean;
  lastEmitTime: number;
  lastAudioEmit?: number;
  lastAnalysisLog?: number; // Track last analysis log emission
}

export class AudioHandler {
  private connections = new Map<string, StreamConnection>();
  private io: any;

  setIO(io: any) {
    this.io = io;
  }

  handleConnection(ws: WebSocket) {
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.event) {
          case 'start':
            await this.handleStart(ws, data);
            break;
          case 'media':
            await this.handleMedia(data);
            break;
          case 'stop':
            this.handleStop(data);
            break;
        }
      } catch (error) {
        logger.error('Audio handler error:', error);
      }
    });
  }

  private async handleStart(ws: WebSocket, data: any) {
    const { streamSid, callSid } = data.start;
    
    logger.info(`🎵 FAST AI detection started: ${callSid}`);
    
    this.connections.set(streamSid, {
      ws,
      callSid,
      audioBuffer: [],
      analysisHistory: [],
      callAnsweredAt: Date.now(),
      tooBusyDetected: false,
      holdMusicDetected: false,
      liveAgentConfidence: 0,
      transferTriggered: false,
      lastEmitTime: 0
    });
  }

  private async handleMedia(data: any) {
    const { streamSid, media } = data;
    if (!media) return;
    
    const connection = this.connections.get(streamSid);
    if (!connection || connection.transferTriggered) return;
    
    const audioChunk = Buffer.from(media.payload, 'base64');
    connection.audioBuffer.push(audioChunk);
    
    // Forward audio to frontend for live listening (NO throttling for best quality)
    // Twilio sends ~50 chunks/sec naturally, Socket.IO can handle it
    if (this.io) {
      const leg = await store.getCallLegByTwilioSid(connection.callSid);
      if (leg) {
        this.io.to(`job:${leg.jobId}`).emit('audio-chunk', {
          legId: leg.id,
          callSid: connection.callSid,
          audio: media.payload, // base64 encoded
          timestamp: Date.now()
        });
      }
    }
    
    if (connection.audioBuffer.length > 100) {
      connection.audioBuffer.shift();
    }
    
    const now = Date.now();
    const lastAnalysis = connection.analysisHistory[connection.analysisHistory.length - 1];
    const interval = liveAgentDetector.getAnalysisInterval();
    
    if (!lastAnalysis || now - lastAnalysis.timestamp >= interval) {
      await this.analyzeAudioFast(connection);
    }
  }

  private async analyzeAudioFast(connection: StreamConnection) {
    const { callSid, audioBuffer, dtmf2SentAt, callAnsweredAt } = connection;
    
    if (audioBuffer.length < 10) return;
    
    const energy = liveAgentDetector.calculateEnergy(audioBuffer);
    const variance = liveAgentDetector.calculateVariance(audioBuffer);
    
    connection.analysisHistory.push({ energy, variance, timestamp: Date.now() });
    
    if (connection.analysisHistory.length > 64) {
      connection.analysisHistory.shift();
    }
    
    const timeSinceDtmf2 = dtmf2SentAt ? (Date.now() - dtmf2SentAt) / 1000 : 0;
    const callDuration = (Date.now() - callAnsweredAt) / 1000;
    
    // Log analysis activity every 5 seconds for debugging
    const now = Date.now();
    if (!connection.lastAnalysisLog || now - connection.lastAnalysisLog > 5000) {
      connection.lastAnalysisLog = now;
      await this.emitDetectionLog(callSid, {
        type: 'status',
        message: `🎙️ Analyzing audio: energy=${energy.toFixed(2)}, variance=${variance.toFixed(2)}`,
        data: { 
          callDuration: callDuration.toFixed(1), 
          timeSinceDtmf2: timeSinceDtmf2.toFixed(1),
          historySize: connection.analysisHistory.length 
        }
      });
    }
    
    // LAYER 1: Voicemail detection
    if (callDuration < 25 && !connection.holdMusicDetected) {
      const isVoicemail = liveAgentDetector.analyzeForVoicemail(
        connection.analysisHistory,
        callDuration
      );
      
      if (isVoicemail) {
        logger.info(`🤖 VOICEMAIL DETECTED, hanging up ${callSid}`);
        
        await this.emitDetectionLog(callSid, {
          type: 'detection',
          message: '🤖 Voicemail detected',
          data: { callDuration, energy, variance }
        });
        
        await this.emitStatus(callSid, {
          status: 'voicemail',
          message: '🤖 Voicemail detected',
          confidence: 0
        });
        
        const leg = await store.getCallLegByTwilioSid(callSid);
        if (leg && leg.status !== 'ENDED') {
          await store.updateCallLeg(leg.id, {
            status: 'FAILED',
            endedAt: new Date().toISOString(),
            lastEventType: 'voicemail'
          });
          await twilioCallingService.hangUp(callSid);
        }
        
        return;
      }
    }
    
    // LAYER 2: "Too busy" detection
    if (timeSinceDtmf2 > 0 && !connection.tooBusyDetected) {
      const isTooBusy = liveAgentDetector.analyzeForTooBusy(
        connection.analysisHistory,
        timeSinceDtmf2
      );
      
      if (isTooBusy) {
        connection.tooBusyDetected = true;
        
        await this.emitDetectionLog(callSid, {
          type: 'detection',
          message: '❌ IRS too busy message detected',
          data: { timeSinceDtmf2, energy, variance }
        });
        
        await this.emitStatus(callSid, {
          status: 'too_busy',
          message: '❌ IRS too busy',
          confidence: 0
        });
        
        setTimeout(async () => {
          const leg = await store.getCallLegByTwilioSid(callSid);
          if (leg && leg.status !== 'ENDED') {
            await store.updateCallLeg(leg.id, {
              status: 'FAILED',
              endedAt: new Date().toISOString(),
              lastEventType: 'too_busy'
            });
            await twilioCallingService.hangUp(callSid);
          }
        }, 3000);
        
        return;
      }
    }
    
    // LAYER 3: Hold music detection
    if (!connection.holdMusicDetected && !connection.tooBusyDetected) {
      const isHoldMusic = liveAgentDetector.analyzeForHoldMusic(
        connection.analysisHistory,
        timeSinceDtmf2
      );
      
      if (isHoldMusic) {
        connection.holdMusicDetected = true;
        
        logger.info(`🎵 Hold music confirmed: ${callSid}`);
        
        await this.emitDetectionLog(callSid, {
          type: 'detection',
          message: '🎵 Hold music confirmed',
          data: { timeSinceDtmf2, energy, variance }
        });
        
        await this.emitStatus(callSid, {
          status: 'hold_music',
          message: '🎵 On hold',
          confidence: 0
        });
        
        const leg = await store.getCallLegByTwilioSid(callSid);
        if (leg && !leg.holdStartedAt) {
          await store.updateCallLeg(leg.id, {
            holdStartedAt: new Date().toISOString(),
            lastEventType: 'hold_music_confirmed'
          });
        }
      }
    }
    
    // LAYER 4: Music stopping detection
    if (connection.holdMusicDetected && !connection.holdMusicStoppedAt) {
      const musicStopped = liveAgentDetector.detectMusicStop(
        connection.analysisHistory
      );
      
      if (musicStopped) {
        connection.holdMusicStoppedAt = Date.now();
        
        logger.info(`🤫 Music stopped: ${callSid} - LISTENING`);
        
        await this.emitDetectionLog(callSid, {
          type: 'detection',
          message: '🤫 Music stopped - listening for agent',
          data: { energy, variance }
        });
        
        await this.emitStatus(callSid, {
          status: 'silence',
          message: '🤫 Listening...',
          confidence: 0.1
        });
      }
    }
    
    // LAYER 5: Live agent speech detection (works with OR without hold music!)
    // Start detecting after DTMF 2 is sent (either with or without hold music)
    if (timeSinceDtmf2 > 15) {
      const { detected, confidence } = liveAgentDetector.analyzeForLiveAgent(
        connection.analysisHistory,
        connection.holdMusicStoppedAt,
        connection.liveAgentConfidence,
        timeSinceDtmf2 // NEW: Pass timing for quick answer detection
      );
      
      connection.liveAgentConfidence = confidence;
      
      // Emit detection updates periodically
      const now = Date.now();
      if (now - connection.lastEmitTime > 500) {
        await this.emitDetectionLog(callSid, {
          type: 'detection',
          message: `🎯 Agent detection: ${(confidence * 100).toFixed(0)}%`,
          data: { confidence, timeSinceDtmf2, energy, variance }
        });
        
        await this.emitStatus(callSid, {
          status: 'detecting_agent',
          message: `🎯 Detecting: ${(confidence * 100).toFixed(0)}%`,
          confidence: confidence
        });
        connection.lastEmitTime = now;
      }
      
      // AUTO-TRANSFER when threshold reached
      if (detected && !connection.transferTriggered) {
        logger.info(`🚀 AUTO-TRANSFER triggered (${(confidence * 100).toFixed(0)}%)`);
        
        await this.emitDetectionLog(callSid, {
          type: 'transfer',
          message: `🚀 Live agent detected! Auto-transfer triggered`,
          data: { confidence, timeSinceDtmf2 }
        });
        
        connection.transferTriggered = true;
        await this.triggerTransfer(callSid, confidence);
      }
      
      // Reset if silence too long (only if hold music was detected)
      if (connection.holdMusicStoppedAt) {
        const silenceDuration = (Date.now() - connection.holdMusicStoppedAt) / 1000;
        if (silenceDuration > 6 && confidence < 0.5) {
          logger.warn(`⚠️  Resetting - silence too long`);
          connection.holdMusicStoppedAt = undefined;
          connection.liveAgentConfidence = 0;
        }
      }
    }
  }

  private async triggerTransfer(callSid: string, confidence: number) {
    try {
      const leg = await store.getCallLegByTwilioSid(callSid);
      if (!leg || leg.status === 'LIVE' || leg.status === 'TRANSFERRED') {
        return;
      }
      
      logger.info(`🔄 TRANSFERRING ${callSid} to queue`);
      
      await store.updateCallLeg(leg.id, {
        status: 'LIVE',
        liveDetectedAt: new Date().toISOString()
      });
      
      const job = await store.getJob(leg.jobId);
      if (!job) return;
      
      // Get queue details
      const queue = await store.getQueue(job.queueId || 'queue-main');
      if (!queue) {
        logger.error('❌ Queue not found!');
        return;
      }
      
      if (!queue.phoneNumber) {
        logger.error(`❌ Queue "${queue.name}" has no phone number!`);
        return;
      }
      
      logger.info(`📞 Transferring to queue: ${queue.name} (${queue.phoneNumber})`);
      
      await this.emitStatus(callSid, {
        status: 'transferring',
        message: `✅ Transferring to ${queue.name}`,
        confidence: confidence
      });
      
      // DIRECT DIAL TO QUEUE
      await twilioCallingService.transferToQueue(callSid, queue.phoneNumber);
      
      await store.updateJob(job.id, {
        status: 'TRANSFERRED',
        transferredAt: new Date().toISOString(),
        winningLegId: leg.id
      });
      
      // Emit success
      if (this.io) {
        this.io.to(`job:${job.id}`).emit('transfer-success', {
          jobId: job.id,
          legId: leg.id,
          callSid,
          queueName: queue.name,
          confidence: (confidence * 100).toFixed(0)
        });
      }
      
      // 🔥 DO NOT hang up other legs - user wants to transfer ALL live agents!
      logger.info(`✅ Call transferred - other calls can continue to detect live agents`);
      
    } catch (error) {
      logger.error('Transfer failed:', error);
    }
  }

  private async emitStatus(callSid: string, status: any) {
    const leg = await store.getCallLegByTwilioSid(callSid);
    if (!leg) return;
    
    if (this.io) {
      this.io.to(`job:${leg.jobId}`).emit('ai-detection', {
        legId: leg.id,
        callSid,
        timestamp: Date.now(),
        ...status
      });
    }
  }

  private async emitDetectionLog(callSid: string, log: any) {
    const leg = await store.getCallLegByTwilioSid(callSid);
    if (!leg) return;
    
    if (this.io) {
      this.io.to(`job:${leg.jobId}`).emit('detection-log', {
        timestamp: new Date().toISOString(),
        callSid,
        legId: leg.id,
        ...log
      });
    }
  }

  private handleStop(data: any) {
    const { streamSid } = data.stop;
    
    const connection = this.connections.get(streamSid);
    if (connection) {
      logger.info(`🛑 Stream stopped: ${connection.callSid} ` +
        `(hold=${connection.holdMusicDetected}, ` +
        `transferred=${connection.transferTriggered}, ` +
        `confidence=${connection.liveAgentConfidence.toFixed(2)})`);
    }
    
    this.connections.delete(streamSid);
  }

  notifyDtmf2Sent(callSid: string) {
    const connection = Array.from(this.connections.values()).find(c => c.callSid === callSid);
    if (connection) {
      connection.dtmf2SentAt = Date.now();
      logger.info(`📱 DTMF #2 timing recorded: ${callSid}`);
      
      // Emit log
      this.emitDetectionLog(callSid, {
        type: 'dtmf',
        message: '📱 DTMF "2" sent - listening for agent',
        data: { digit: '2' }
      });
    }
  }

  async notifyDtmf1Sent(callSid: string) {
    await this.emitDetectionLog(callSid, {
      type: 'dtmf',
      message: '📱 DTMF "1" sent - English selected',
      data: { digit: '1' }
    });
  }
}

export const audioHandler = new AudioHandler();
