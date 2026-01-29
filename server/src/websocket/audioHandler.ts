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
    
    // Forward audio to frontend for live listening
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
    
    // LAYER 1: Voicemail detection
    if (callDuration < 25 && !connection.holdMusicDetected) {
      const isVoicemail = liveAgentDetector.analyzeForVoicemail(
        connection.analysisHistory,
        callDuration
      );
      
      if (isVoicemail) {
        logger.info(`🤖 VOICEMAIL DETECTED, hanging up ${callSid}`);
        
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
        
        await this.emitStatus(callSid, {
          status: 'silence',
          message: '🤫 Listening...',
          confidence: 0.1
        });
      }
    }
    
    // LAYER 5: Live agent speech detection
    if (connection.holdMusicStoppedAt) {
      const { detected, confidence } = liveAgentDetector.analyzeForLiveAgent(
        connection.analysisHistory,
        connection.holdMusicStoppedAt,
        connection.liveAgentConfidence
      );
      
      connection.liveAgentConfidence = confidence;
      
      const now = Date.now();
      if (now - connection.lastEmitTime > 500) {
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
        
        connection.transferTriggered = true;
        await this.triggerTransfer(callSid, confidence);
      }
      
      // Reset if silence too long
      const silenceDuration = (Date.now() - connection.holdMusicStoppedAt) / 1000;
      if (silenceDuration > 6 && confidence < 0.5) {
        logger.warn(`⚠️  Resetting - silence too long`);
        connection.holdMusicStoppedAt = undefined;
        connection.liveAgentConfidence = 0;
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
      
      // Hang up other legs (staggered)
      const allLegs = await store.getJobLegs(job.id);
      const otherLegs = allLegs.filter((l: any) => l.id !== leg.id && l.twilioCallSid);
      
      logger.info(`🧹 Hanging up ${otherLegs.length} losing calls`);
      
      for (const otherLeg of otherLegs) {
        const delay = Math.floor(Math.random() * 10000) + 5000;
        setTimeout(async () => {
          if (otherLeg.twilioCallSid) {
            await twilioCallingService.hangUp(otherLeg.twilioCallSid);
            await store.updateCallLeg(otherLeg.id, {
              status: 'ENDED',
              endedAt: new Date().toISOString()
            });
          }
        }, delay);
      }
      
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
    }
  }
}

export const audioHandler = new AudioHandler();
