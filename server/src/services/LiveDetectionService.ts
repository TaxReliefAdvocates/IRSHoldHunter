import { store, CallLeg } from '../storage/RedisStore.js';
import logger from '../config/logger.js';

export interface DetectionResult {
  shouldTransfer: boolean;
  confidence: number;
  reason: string;
  strategiesPassed: string[];
}

export interface DetectionStrategy {
  name: string;
  check(leg: CallLeg, eventHistory: any[]): boolean;
}

// Strategy 1: Time-based heuristic (most reliable for IRS)
class TimeBasedStrategy implements DetectionStrategy {
  name = 'Time-Based Heuristic';
  
  check(leg: CallLeg, events: any[]): boolean {
    // If call has been on hold for 5+ minutes, and just answered, likely human
    if (leg.status !== 'ANSWERED') return false;
    
    if (!leg.holdStartedAt) return false;
    
    const holdDuration = Date.now() - new Date(leg.holdStartedAt).getTime();
    const minHoldTime = parseInt(process.env.LIVE_DETECTION_MIN_HOLD_TIME || '300000'); // 5 minutes
    
    // Check if was holding and recently transitioned to answered
    const wasHolding = events.some(e => e.status === 'HOLDING');
    const recentAnswer = events.length > 0 && events[events.length - 1]?.status === 'ANSWERED';
    
    const passed = holdDuration > minHoldTime && wasHolding && recentAnswer;
    
    if (passed) {
      logger.debug(`Time-based strategy passed for leg ${leg.id}: hold duration ${Math.floor(holdDuration / 1000)}s`);
    }
    
    return passed;
  }
}

// Strategy 2: Hold transition (existing logic)
class HoldTransitionStrategy implements DetectionStrategy {
  name = 'Hold→Answered Transition';
  
  check(leg: CallLeg, events: any[]): boolean {
    if (events.length < 2) return false;
    
    const lastTwo = events.slice(-2);
    const passed = lastTwo[0]?.status === 'HOLDING' && lastTwo[1]?.status === 'ANSWERED';
    
    if (passed) {
      logger.debug(`Hold transition strategy passed for leg ${leg.id}`);
    }
    
    return passed;
  }
}

// Strategy 3: Call duration pattern
class CallDurationStrategy implements DetectionStrategy {
  name = 'Call Duration Pattern';
  
  check(leg: CallLeg, events: any[]): boolean {
    // IVR typically answers within 30 seconds
    // If call has been active for 30+ seconds after being answered, likely human
    
    const answerEvent = events.find(e => e.status === 'ANSWERED');
    if (!answerEvent) return false;
    
    const timeSinceAnswer = Date.now() - new Date(answerEvent.timestamp).getTime();
    const minAnswerTime = parseInt(process.env.LIVE_DETECTION_MIN_ANSWER_TIME || '30000'); // 30 seconds
    
    const passed = leg.status === 'ANSWERED' && timeSinceAnswer > minAnswerTime;
    
    if (passed) {
      logger.debug(`Duration strategy passed for leg ${leg.id}: ${Math.floor(timeSinceAnswer / 1000)}s since answer`);
    }
    
    return passed;
  }
}

// Strategy 4: Multiple hold cycles (IRS-specific)
class MultipleHoldCyclesStrategy implements DetectionStrategy {
  name = 'Multiple Hold Cycles';
  
  check(leg: CallLeg, events: any[]): boolean {
    // Count how many times the call has cycled between HOLDING and ANSWERED
    // Multiple cycles often indicate a live agent transfer
    
    let holdCycles = 0;
    let lastStatus = '';
    
    for (const event of events) {
      if (event.status === 'HOLDING' && lastStatus === 'ANSWERED') {
        holdCycles++;
      }
      lastStatus = event.status;
    }
    
    const passed = holdCycles >= 2 && leg.status === 'ANSWERED';
    
    if (passed) {
      logger.debug(`Hold cycles strategy passed for leg ${leg.id}: ${holdCycles} cycles detected`);
    }
    
    return passed;
  }
}

class LiveDetectionService {
  private strategies: DetectionStrategy[];
  
  constructor() {
    this.strategies = [
      new TimeBasedStrategy(),
      new HoldTransitionStrategy(),
      new CallDurationStrategy(),
      new MultipleHoldCyclesStrategy()
    ];
    
    logger.info(`Live detection initialized with ${this.strategies.length} strategies`);
  }
  
  async shouldTriggerTransfer(leg: CallLeg): Promise<DetectionResult> {
    // Check if manually confirmed
    const manualConfirm = await store.getConfig(`leg:${leg.id}:manual_confirm`);
    if (manualConfirm === 'true') {
      logger.info(`✅ Leg ${leg.id}: Manual confirmation detected`);
      return { 
        shouldTransfer: true, 
        confidence: 1.0, 
        reason: 'Manual confirmation by operator',
        strategiesPassed: ['Manual Confirmation']
      };
    }
    
    // Check if manual confirmation is required (bypass automatic detection)
    if (process.env.LIVE_DETECTION_REQUIRE_MANUAL === 'true') {
      return {
        shouldTransfer: false,
        confidence: 0,
        reason: 'Manual confirmation required (LIVE_DETECTION_REQUIRE_MANUAL=true)',
        strategiesPassed: []
      };
    }
    
    // Get event history for this leg
    const eventHistory = await store.getEventHistory(leg.id);
    
    // Run all strategies
    const results = this.strategies.map(strategy => ({
      name: strategy.name,
      passed: strategy.check(leg, eventHistory)
    }));
    
    const strategiesPassed = results.filter(r => r.passed).map(r => r.name);
    const passedCount = strategiesPassed.length;
    const confidence = passedCount / this.strategies.length;
    
    // Configurable minimum confidence threshold
    const minConfidence = parseFloat(process.env.LIVE_DETECTION_MIN_CONFIDENCE || '0.5');
    const shouldTransfer = confidence >= minConfidence;
    
    const reason = shouldTransfer 
      ? `Strategies passed (${passedCount}/${this.strategies.length}): ${strategiesPassed.join(', ')}`
      : `Not enough confidence (${(confidence * 100).toFixed(0)}% < ${(minConfidence * 100).toFixed(0)}% required)`;
    
    logger.info(`Live detection for leg ${leg.id}:`, {
      confidence: `${(confidence * 100).toFixed(0)}%`,
      shouldTransfer,
      strategiesPassed,
      reason
    });
    
    return {
      shouldTransfer,
      confidence,
      reason,
      strategiesPassed
    };
  }
  
  async addEvent(legId: string, event: any): Promise<void> {
    await store.addEvent(legId, event);
  }
  
  async getDetectionStatus(legId: string): Promise<DetectionResult> {
    const leg = await store.getCallLeg(legId);
    if (!leg) {
      return {
        shouldTransfer: false,
        confidence: 0,
        reason: 'Leg not found',
        strategiesPassed: []
      };
    }
    
    return await this.shouldTriggerTransfer(leg);
  }
  
  async manuallyConfirmLive(legId: string): Promise<void> {
    await store.setConfig(`leg:${legId}:manual_confirm`, 'true');
    logger.info(`✅ Leg ${legId}: Manually confirmed as live agent`);
  }
}

export default new LiveDetectionService();
