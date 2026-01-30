import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import logger from '../config/logger.js';

interface TranscriptCallback {
  (callSid: string, transcript: string, isFinal: boolean): void;
}

export class SpeechRecognitionService {
  private deepgramClient: any = null;
  private connections = new Map<string, any>();
  private keepaliveIntervals = new Map<string, NodeJS.Timeout>();
  private transcriptCallbacks: TranscriptCallback[] = [];
  
  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    const enabled = process.env.ENABLE_SPEECH_RECOGNITION === 'true';
    
    if (enabled && apiKey) {
      this.deepgramClient = createClient(apiKey);
      logger.info('✅ Speech recognition enabled (Deepgram)');
    } else if (enabled && !apiKey) {
      logger.warn('⚠️  Speech recognition enabled but DEEPGRAM_API_KEY not set');
    } else {
      logger.info('ℹ️  Speech recognition disabled (set ENABLE_SPEECH_RECOGNITION=true to enable)');
    }
  }

  isEnabled(): boolean {
    return this.deepgramClient !== null;
  }

  onTranscript(callback: TranscriptCallback) {
    this.transcriptCallbacks.push(callback);
  }

  async startTranscription(callSid: string) {
    if (!this.deepgramClient) return;

    try {
      logger.info(`🎤 Starting speech recognition for ${callSid}`);
      
      const connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1,
        keepalive: true
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        logger.info(`🎤 Speech recognition connected: ${callSid}`);
        
        // CRITICAL: Send keepalive every 3 seconds to prevent timeout
        const keepaliveInterval = setInterval(() => {
          if (connection.getReadyState() === 1) {
            try {
              connection.keepAlive();
              logger.debug(`💓 Keepalive sent for ${callSid}`);
            } catch (err) {
              logger.warn(`Failed to send keepalive for ${callSid}:`, err);
            }
          }
        }, 3000);
        
        this.keepaliveIntervals.set(callSid, keepaliveInterval);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel.alternatives[0]?.transcript;
        if (transcript && transcript.trim()) {
          const isFinal = data.is_final;
          
          logger.info(`🗣️  [${callSid.slice(-6)}] ${isFinal ? 'FINAL' : 'interim'}: "${transcript}"`);
          
          // Notify all callbacks
          this.transcriptCallbacks.forEach(cb => cb(callSid, transcript, isFinal));
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        logger.error(`❌ Speech recognition error for ${callSid}:`, error);
        // Don't delete connection on error - let it reconnect
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        logger.warn(`⚠️  Speech recognition closed unexpectedly: ${callSid}`);
        
        // Clear keepalive interval
        const interval = this.keepaliveIntervals.get(callSid);
        if (interval) {
          clearInterval(interval);
          this.keepaliveIntervals.delete(callSid);
        }
        
        this.connections.delete(callSid);
        
        // AUTO-RECONNECT if connection closes unexpectedly
        // Check if call is still active before reconnecting
        setTimeout(() => {
          if (!this.connections.has(callSid)) {
            logger.info(`🔄 Auto-reconnecting speech recognition for ${callSid}`);
            this.startTranscription(callSid);
          }
        }, 1000);
      });

      this.connections.set(callSid, connection);
      
    } catch (error) {
      logger.error(`Failed to start speech recognition for ${callSid}:`, error);
    }
  }

  sendAudio(callSid: string, audioData: Buffer) {
    const connection = this.connections.get(callSid);
    if (connection && connection.getReadyState() === 1) {
      connection.send(audioData);
    }
  }

  stopTranscription(callSid: string) {
    const connection = this.connections.get(callSid);
    if (connection) {
      logger.info(`🛑 Stopping speech recognition: ${callSid}`);
      
      // Clear keepalive interval
      const interval = this.keepaliveIntervals.get(callSid);
      if (interval) {
        clearInterval(interval);
        this.keepaliveIntervals.delete(callSid);
      }
      
      connection.finish();
      this.connections.delete(callSid);
    }
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
