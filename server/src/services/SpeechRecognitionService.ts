import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import logger from '../config/logger.js';

interface TranscriptCallback {
  (callSid: string, transcript: string, isFinal: boolean): void;
}

export class SpeechRecognitionService {
  private deepgramClient: any = null;
  private connections = new Map<string, any>();
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
        channels: 1
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        logger.info(`🎤 Speech recognition connected: ${callSid}`);
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
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        logger.info(`🎤 Speech recognition closed: ${callSid}`);
        this.connections.delete(callSid);
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
      connection.finish();
      this.connections.delete(callSid);
    }
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
