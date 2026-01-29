import logger from '../config/logger.js';

interface AudioAnalysis {
  energy: number;
  variance: number;
  timestamp: number;
}

export class LiveAgentDetector {
  // AGGRESSIVE THRESHOLDS (optimized for SPEED)
  private readonly ENERGY_SILENT = 80;
  private readonly ENERGY_SPEECH_MIN = 100;
  private readonly VARIANCE_SPEECH_MIN = 60;
  private readonly VARIANCE_MUSIC_MAX = 60;
  private readonly CONFIDENCE_THRESHOLD = 0.60;
  
  // TIMING (optimized for SPEED)
  private readonly MIN_SILENCE_BEFORE_AGENT = 0.8; // 800ms
  private readonly MAX_SILENCE_BEFORE_RESET = 6; // 6 seconds
  private readonly ANALYSIS_INTERVAL_MS = 250; // 250ms

  analyzeForTooBusy(
    analysisHistory: AudioAnalysis[],
    timeSinceDtmf2: number
  ): boolean {
    if (timeSinceDtmf2 < 3 || timeSinceDtmf2 > 15) return false;
    
    const recent = analysisHistory.slice(-10);
    if (recent.length < 10) return false;
    
    const avgEnergy = recent.reduce((sum, a) => sum + a.energy, 0) / recent.length;
    
    const isMessage = avgEnergy > 150 && avgEnergy < 350;
    
    if (isMessage) {
      logger.info(`❌ "Too busy" pattern detected`);
      return true;
    }
    
    return false;
  }

  analyzeForHoldMusic(
    analysisHistory: AudioAnalysis[],
    timeSinceDtmf2: number
  ): boolean {
    if (timeSinceDtmf2 < 8) return false;
    
    const recent = analysisHistory.slice(-32); // Last 8 seconds
    if (recent.length < 32) return false;
    
    const avgEnergy = recent.reduce((sum, a) => sum + a.energy, 0) / recent.length;
    const avgVariance = recent.reduce((sum, a) => sum + a.variance, 0) / recent.length;
    
    const isConsistentAudio = 
      avgEnergy > 180 && 
      avgEnergy < 550 && 
      avgVariance < this.VARIANCE_MUSIC_MAX &&
      recent.every(a => a.energy > 120);
    
    if (isConsistentAudio) {
      logger.info(`🎵 Hold music pattern confirmed`);
      return true;
    }
    
    return false;
  }

  analyzeForLiveAgent(
    analysisHistory: AudioAnalysis[],
    holdMusicStoppedAt: number | undefined,
    currentConfidence: number
  ): { detected: boolean; confidence: number } {
    if (!holdMusicStoppedAt) {
      return { detected: false, confidence: currentConfidence };
    }
    
    const silenceDuration = (Date.now() - holdMusicStoppedAt) / 1000;
    const recent = analysisHistory.slice(-8);
    
    if (recent.length < 8) {
      return { detected: false, confidence: currentConfidence };
    }
    
    let confidence = currentConfidence;
    
    // STRATEGY 1: Speech pattern detection
    const speechCount = recent.filter(a => 
      a.energy > this.ENERGY_SPEECH_MIN && 
      a.variance > this.VARIANCE_SPEECH_MIN
    ).length;
    
    if (speechCount >= 5) {
      confidence += 0.35;
      logger.info(`🎯 Strong speech pattern (${speechCount}/8 chunks)`);
    } else if (speechCount >= 3) {
      confidence += 0.20;
      logger.info(`🎯 Moderate speech pattern (${speechCount}/8 chunks)`);
    }
    
    // STRATEGY 2: Energy variance
    const avgEnergy = recent.reduce((sum, a) => sum + a.energy, 0) / recent.length;
    const energyStdDev = Math.sqrt(
      recent.reduce((sum, a) => sum + Math.pow(a.energy - avgEnergy, 2), 0) / recent.length
    );
    
    if (energyStdDev > 40) {
      confidence += 0.25;
      logger.info(`🎯 High variance detected (human speech)`);
    }
    
    // STRATEGY 3: Timing
    if (silenceDuration > this.MIN_SILENCE_BEFORE_AGENT && silenceDuration < 3) {
      confidence += 0.20;
      logger.info(`🎯 Optimal silence timing (${silenceDuration.toFixed(1)}s)`);
    }
    
    const detected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    return { detected, confidence };
  }

  detectMusicStop(analysisHistory: AudioAnalysis[]): boolean {
    if (analysisHistory.length < 16) return false;
    
    const previousMusic = analysisHistory.slice(-16, -8);
    const recentSilence = analysisHistory.slice(-4);
    
    const hadMusic = previousMusic.length >= 8 && 
      previousMusic.every(a => a.energy > 180 && a.variance < this.VARIANCE_MUSIC_MAX);
    
    const nowSilent = recentSilence.length >= 4 && 
      recentSilence.every(a => a.energy < this.ENERGY_SILENT);
    
    if (hadMusic && nowSilent) {
      logger.info(`🤫 Music → Silence transition detected`);
      return true;
    }
    
    return false;
  }

  analyzeForVoicemail(
    analysisHistory: AudioAnalysis[],
    callDuration: number
  ): boolean {
    // Voicemail patterns:
    // 1. Brief greeting (5-20 seconds)
    // 2. Moderate energy with variance (human speech)
    // 3. Then silence or beep
    
    if (callDuration < 5 || callDuration > 20) return false;
    
    const recent = analysisHistory.slice(-20);
    if (recent.length < 20) return false;
    
    const avgEnergy = recent.reduce((sum, a) => sum + a.energy, 0) / recent.length;
    const avgVariance = recent.reduce((sum, a) => sum + a.variance, 0) / recent.length;
    
    // Voicemail greeting: moderate energy, human-like variance
    const isGreetingPattern = 
      avgEnergy > 150 && 
      avgEnergy < 400 && 
      avgVariance > 80 &&
      callDuration < 20;
    
    if (isGreetingPattern) {
      logger.info(`🤖 Voicemail pattern detected (${callDuration.toFixed(1)}s, energy=${avgEnergy.toFixed(0)}, var=${avgVariance.toFixed(0)})`);
      return true;
    }
    
    return false;
  }

  calculateEnergy(buffer: Buffer[]): number {
    if (buffer.length === 0) return 0;
    
    let totalEnergy = 0;
    buffer.forEach(chunk => {
      let sum = 0;
      for (let i = 0; i < chunk.length; i++) {
        const sample = chunk[i] - 128;
        sum += sample * sample;
      }
      totalEnergy += Math.sqrt(sum / chunk.length);
    });
    
    return totalEnergy / buffer.length;
  }

  calculateVariance(buffer: Buffer[]): number {
    if (buffer.length < 2) return 0;
    
    const energies = buffer.map(chunk => {
      let sum = 0;
      for (let i = 0; i < chunk.length; i++) {
        const sample = chunk[i] - 128;
        sum += sample * sample;
      }
      return Math.sqrt(sum / chunk.length);
    });
    
    const mean = energies.reduce((a, b) => a + b) / energies.length;
    return energies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / energies.length;
  }

  getAnalysisInterval(): number {
    return this.ANALYSIS_INTERVAL_MS;
  }

  getConfidenceThreshold(): number {
    return this.CONFIDENCE_THRESHOLD;
  }
}

export const liveAgentDetector = new LiveAgentDetector();
