# 🎧 Live Audio Monitor - User Guide

## What It Does

The Live Audio Monitor allows you to **listen in real-time** to what the AI is hearing during IRS calls. This is invaluable for:

- **Testing AI detection** - Hear exactly when hold music starts/stops
- **Debugging false positives** - Understand why AI detected something incorrectly
- **Training improvement** - Identify patterns the AI should learn
- **Confidence verification** - Confirm AI is making good decisions

---

## How to Use

### 1. Start a Job

Start a job with 1-3 lines to the IRS number.

### 2. Open the Live Audio Monitor

Once the job is running, you'll see a new section titled:

**"🎧 Live Audio Monitor"**

This appears between the job status and the call legs table.

### 3. Click "🎧 Listen Live"

The button will:
- Initialize your browser's audio system
- Start receiving audio chunks from the WebSocket
- Display a live audio level meter
- Show a red "LIVE" indicator

### 4. Listen to the Call

You'll hear:
- ✅ IRS IVR menu ("Thank you for calling...")
- ✅ DTMF tones (beep sounds when "1" and "2" are pressed)
- ✅ Hold music (repetitive patterns)
- ✅ Silence when music stops
- ✅ Live agent voice when they pick up

**Audio is:**
- **Real-time** - Only ~50-100ms delay
- **Raw stream** - Exactly what the AI analyzes
- **Mulaw 8kHz** - Standard telephone audio quality

### 5. Stop Listening

Click **"🔇 Stop Listening"** to:
- Stop audio playback
- Free up browser resources
- Reset the audio system

---

## Technical Details

### Audio Format

- **Codec**: μ-law (mulaw)
- **Sample Rate**: 8000 Hz (8 kHz)
- **Channels**: 1 (mono)
- **Bitrate**: ~64 kbps
- **Latency**: 50-100ms

### Volume Control

The audio is **boosted 2x** for clarity. If it's too loud or quiet, adjust your system volume.

### Browser Compatibility

Works in:
- ✅ Chrome/Edge (best performance)
- ✅ Firefox
- ✅ Safari (may require user gesture first)

### Limitations

1. **No rewind/pause** - It's live streaming only
2. **Single stream** - Listens to all legs in the job
3. **Browser must stay open** - Closing tab stops playback
4. **No recording** - Audio is not saved (privacy)

---

## Troubleshooting

### "No audio playing"
- Check browser console for errors
- Ensure you clicked "Listen Live" AFTER the call started
- Try refreshing the page

### "Audio is choppy"
- Close other tabs/apps
- Check network connection
- Reduce number of concurrent call legs

### "Audio level meter stuck at 0%"
- The call might be in silence
- Wait for hold music or agent to speak
- Check backend logs for WebSocket connection

---

## What to Listen For

### ✅ **Voicemail Detection**
- Listen for: Long sustained message (15-20 seconds)
- AI should detect and hang up within 5 seconds

### ✅ **"Too Busy" Detection**
- Listen for: "Due to high call volume..."
- AI should detect after DTMF 2 is sent

### ✅ **Hold Music**
- Listen for: Repetitive, low-variance patterns
- AI should mark as "ON HOLD"

### ✅ **Music Stopping**
- Listen for: Sudden drop in volume
- AI should enter "LISTENING" mode

### ✅ **Live Agent**
- Listen for: Human speech with high variance
- AI confidence should build from 0% → 60%+
- Transfer should trigger automatically

---

## Privacy & Security

- ✅ Audio streams **directly** from backend to your browser
- ✅ No third-party services involved
- ✅ Not recorded or stored anywhere
- ✅ Only you can hear it (not shared with other users)
- ✅ Stops when you close the tab

---

## Performance Impact

**Minimal:**
- ~64 kbps network bandwidth
- ~5% CPU for audio decoding
- ~10 MB RAM for audio buffers

Safe to run on multiple jobs simultaneously!

---

## Future Enhancements

Possible improvements:
- [ ] Visual spectrogram display
- [ ] Frequency analysis overlay
- [ ] Replay last 30 seconds
- [ ] Download audio clips
- [ ] Multi-leg selector (listen to specific leg)

---

**Enjoy testing! 🎧**
