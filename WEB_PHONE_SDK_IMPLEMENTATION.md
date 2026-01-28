# Web Phone SDK Implementation Guide

## Overview

The Web Phone SDK allows you to create **virtual phone devices** programmatically, without needing physical RC Phone apps running. Each virtual device can make/receive calls independently.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Your Server Process                                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ Web Phone Manager                              │     │
│  │                                                │     │
│  │  [Virtual Device 1] ← Extension 101            │     │
│  │  [Virtual Device 2] ← Extension 105            │     │
│  │  [Virtual Device 3] ← Extension 106            │     │
│  │  ...                                           │     │
│  │  [Virtual Device 50] ← Extension 9330          │     │
│  │                                                │     │
│  │  Each device = Full SIP registration          │     │
│  │  Can make calls, receive calls, transfer      │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  Your existing RCService calls these virtual devices    │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd /Users/lindseystevens/IRSAgent/server
npm install @ringcentral/sdk ringcentral-web-phone
```

### Step 2: Configure Extension Credentials

You need username/password for each extension you want to use.

**Option A: Extension Credentials** (if you have them)
```env
# In server/.env
EXT_101_USERNAME=101
EXT_101_PASSWORD=password123

EXT_105_USERNAME=105
EXT_105_PASSWORD=password456
# ... for each extension
```

**Option B: JWT Tokens** (recommended)
Generate JWT tokens for each extension via RingCentral Admin Portal:
1. Go to Admin Portal → Apps → Create Custom App
2. Select "JWT Credentials Flow"
3. Grant permissions: `VoIP Calling`, `Call Control`, `Read Accounts`
4. Generate JWT for each extension

```env
EXT_101_JWT=eyJraWQ...
EXT_105_JWT=eyJraWQ...
```

### Step 3: Initialize Web Phones on Server Start

Modify `server/src/server.ts`:

```typescript
import WebPhoneManager from './services/WebPhoneManager.js';

// Initialize Web Phone Manager
const webPhoneManager = new WebPhoneManager(
  process.env.RC_CLIENT_ID!,
  process.env.RC_CLIENT_SECRET!,
  process.env.RC_SERVER_URL!
);

// Initialize Web Phones for configured extensions
async function initializeWebPhones() {
  const extensions = [
    { id: '62378666006', number: '101', username: '101', password: process.env.EXT_101_PASSWORD },
    { id: '62449168006', number: '105', username: '105', password: process.env.EXT_105_PASSWORD },
    // ... add more
  ];

  for (const ext of extensions) {
    try {
      await webPhoneManager.initializeWebPhone(
        ext.id,
        ext.number,
        ext.username,
        ext.password
      );
      logger.info(`✅ Web Phone initialized for extension ${ext.number}`);
    } catch (error) {
      logger.error(`❌ Failed to initialize Web Phone for extension ${ext.number}:`, error);
    }
  }
}

// Call on server start
await initializeWebPhones();
```

### Step 4: Modify RCService to Use Web Phones

In `server/src/services/RCService.ts`, add a method to use Web Phone:

```typescript
import webPhoneManager from '../config/webphone.js'; // Singleton instance

async initiatePlaceCall(fromExtensionId: string, toPhoneNumber: string): Promise<{ sessionId: string; partyId: string }> {
  try {
    // Try Web Phone first
    const instance = webPhoneManager.getAvailableInstance();
    
    if (instance) {
      logger.info(`📞 Using Web Phone for extension ${instance.extensionNumber}`);
      
      const result = await webPhoneManager.makeCall(instance.extensionId, toPhoneNumber);
      
      return {
        sessionId: result.sessionId,
        partyId: result.sessionId, // For Web Phone, sessionId = partyId
      };
    }
    
    // Fallback to existing Call-Out API logic
    // ... (your existing code)
    
  } catch (error) {
    logger.error(`Failed to initiate call:`, error);
    throw error;
  }
}
```

### Step 5: Audio Processing for Hold Detection

The Web Phone SDK provides access to the **audio stream**, which you can analyze for hold detection:

```typescript
// In your hold detection service
import webPhoneManager from '../config/webphone.js';

async function detectHold(extensionId: string): Promise<boolean> {
  const audioStream = webPhoneManager.getAudioStream(extensionId);
  
  if (!audioStream) {
    return false;
  }
  
  // Analyze audio stream
  // Option 1: Use Web Audio API
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(audioStream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  
  // Option 2: Send to speech-to-text API
  // Option 3: Frequency analysis for hold music patterns
  
  // Return true if hold music detected
  return isHoldMusic;
}
```

---

## Advantages

### ✅ Pros:
1. **No Physical Devices**: No need for VMs or computers running RC Phone
2. **Fully Scalable**: Can create 50+ concurrent virtual devices
3. **Programmatic Control**: Complete control over audio, call flow
4. **Cost Effective**: No infrastructure costs for devices
5. **Real Audio Access**: Can analyze audio stream for hold detection

### ⚠️ Cons:
1. **Development Complexity**: Requires WebRTC knowledge
2. **Audio Handling**: Need to implement hold detection from audio stream
3. **Server Resources**: Audio processing is CPU-intensive
4. **Initial Setup**: More complex than using physical RC Phone apps

---

## Cost Breakdown

### Physical Devices (Current Approach):
- 50 AWS EC2 t3.micro instances = ~$300/month
- OR 50 physical computers (one-time cost + maintenance)

### Web Phone SDK:
- 1 powerful server (e.g., AWS c5.4xlarge) = ~$500/month
- Can handle 50-100+ concurrent calls
- Saves on infrastructure complexity

---

## Performance Considerations

### CPU Usage:
- Each Web Phone instance: ~50MB RAM
- Audio processing per call: ~10-20% CPU
- 50 concurrent calls = ~2.5GB RAM, 50-100% CPU (4-8 cores)

### Recommended Server Specs:
- **CPU**: 8+ cores
- **RAM**: 16GB+
- **Network**: 100 Mbps+ (for audio streams)

---

## Hold Detection Strategy

With Web Phone SDK, you have **direct audio access**:

### Option 1: Frequency Analysis
- Hold music has distinct frequency patterns
- Use FFT (Fast Fourier Transform) to analyze
- Detect repeating musical patterns

### Option 2: Speech-to-Text
- Send audio to Google Speech-to-Text / AWS Transcribe
- If no speech detected for 10+ seconds → hold
- If speech detected → live person

### Option 3: Silence Detection
- Hold music = continuous audio
- Live person = periodic silence (thinking, talking)
- Measure silence intervals

### Recommended: Hybrid Approach
Combine all three methods for best accuracy.

---

## Sample Audio Processing Code

```typescript
import { WebAudioAPI } from 'web-audio-api';

class HoldDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  
  async analyzeStream(stream: MediaStream): Promise<boolean> {
    // Create audio context
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    
    // Create analyser
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    
    // Get frequency data
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Analyze for hold music patterns
    const isHoldMusic = this.detectMusicPattern(dataArray);
    
    return isHoldMusic;
  }
  
  private detectMusicPattern(frequencyData: Uint8Array): boolean {
    // Look for consistent frequency bands typical of music
    // Hold music typically has energy in multiple frequency bands
    
    let energyCount = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > 100) {
        energyCount++;
      }
    }
    
    // If >30% of frequency bins have energy, likely music
    const musicThreshold = frequencyData.length * 0.3;
    return energyCount > musicThreshold;
  }
}
```

---

## Migration Path

### Phase 1: Proof of Concept (Week 1-2)
- Initialize 1 Web Phone instance
- Make test calls
- Verify audio stream access
- Test basic hold detection

### Phase 2: Multi-Instance (Week 3-4)
- Initialize 5-10 Web Phone instances
- Test concurrent calls
- Optimize resource usage
- Measure CPU/RAM requirements

### Phase 3: Production Scale (Week 5-6)
- Scale to 50+ instances
- Deploy to production server
- Implement monitoring
- Fine-tune hold detection

### Phase 4: Full Migration (Week 7-8)
- Replace all physical devices
- Full automated testing
- Performance optimization
- Documentation

---

## Resources

### Official Documentation:
- **Web Phone SDK**: https://github.com/ringcentral/ringcentral-web-phone
- **API Reference**: https://developers.ringcentral.com/api-reference
- **WebRTC Guide**: https://developers.ringcentral.com/guide/voice/webrtc

### Community:
- **RingCentral Developer Forum**: https://community.ringcentral.com/
- **GitHub Issues**: https://github.com/ringcentral/ringcentral-web-phone/issues

### Audio Processing Libraries:
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **FFT.js**: https://www.npmjs.com/package/fft.js
- **Google Speech-to-Text**: https://cloud.google.com/speech-to-text

---

## Next Steps

1. **Install dependencies**: `npm install @ringcentral/sdk ringcentral-web-phone`
2. **Get extension credentials**: JWT tokens or username/password
3. **Test with 1 instance**: Initialize one Web Phone and make a test call
4. **Implement hold detection**: Analyze audio stream
5. **Scale gradually**: Add more instances as needed

---

## Support

If you need help with implementation:
1. Start with RingCentral's Web Phone SDK examples
2. Join the RingCentral Developer Forum
3. Review the GitHub repository for code samples
4. Consider hiring a WebRTC consultant for audio processing

This is a **significant** but **very scalable** solution for 50+ concurrent calls!
