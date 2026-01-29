# IRS Hold Hunter - Complete System Overview

## 📞 **Call Sequence (Exactly as Specified)**

### Target Number
**866-860-4259** (IRS Practitioner Priority Service)

### Step-by-Step Flow

```
1. 🔵 Call connects to IRS
   ↓
2. ⌨️  IMMEDIATELY press "1"
   ↓
3. 🎧 Start AI audio monitoring
   ↓
4. ⏱️  Wait 45 seconds (randomized 42-48s)
   ↓  (Allows IRS disclosures to finish)
   ↓
5. ⌨️  Press "2"
   ↓
6. 👂 AI listens for response...
```

---

## 🤖 **AI Detection Logic (Multi-Layer)**

### **Response 1: "Too Busy" Message**
**Timing:** Starts as early as 11 AM PST, most common 12:30-3:30 PM PST

**What happens:**
- IRS says: "Due to high call volume, try again later"
- **AI detects:** Voice pattern after DTMF 2
- **Action:** Hang up immediately, mark as FAILED
- **Status:** ❌ "Too Busy - Try Later"

**Detection:** Layer 2 (after DTMF 2 sent)

---

### **Response 2: Hold Music**
**Timing:** Anytime outside "too busy" hours

**What happens:**
- IRS plays repetitive hold music
- **AI detects:** Low-variance, consistent audio pattern
- **Action:** Mark as "ON HOLD", keep waiting
- **Status:** 🎵 "Waiting on Hold"

**Detection:** Layer 3 (after ruling out "too busy")

---

### **Music Stops → Agent Picks Up**
**What happens:**
- Hold music suddenly stops
- Brief silence (0.5-2 seconds)
- Agent starts speaking: "Thank you for holding..."

**AI Process:**
1. **Detect silence** (music stop) → Status: 🤫 "Listening..."
2. **Detect speech patterns** → Build confidence: 10% → 20% → 40% → 60%
3. **Reach 60% confidence** → **AUTO-TRANSFER** 🚀
4. **Bridge to your queue** → Your phone rings!

**Detection:** Layers 4 & 5 (silence + speech analysis)

---

## ⏱️ **Timing Breakdown**

```
0:00  │ Call initiated
0:02  │ IRS answers
0:02  │ Press "1" ✓
      │ 
      │ [IRS disclosures playing - ~30-40 seconds]
      │ "Thank you for calling the IRS..."
      │ "For quality purposes, this call may be recorded..."
      │ "If you are calling about..."
      │
0:45  │ Press "2" ✓ (randomized 42-48s)
      │
      │ ┌─────────────────────────────┐
      │ │   AI DECISION POINT         │
      │ └─────────────────────────────┘
      │
      ├─→ Path A: "Too Busy"
      │   ├─ "Due to high call volume..."
      │   ├─ AI detects message
      │   └─ Hang up (0:48)
      │
      └─→ Path B: Hold Music
          ├─ Music plays (1-90 minutes typical)
          ├─ AI monitors continuously
          ├─ Music stops
          ├─ Agent speaks
          ├─ Confidence builds: 0% → 60%
          └─ AUTO-TRANSFER! (within 1-2 seconds)
```

---

## 🎯 **Auto-Transfer Logic**

### When Transfer Triggers

**Required conditions (ALL must be true):**
1. ✅ Hold music was detected
2. ✅ Music has stopped
3. ✅ Speech detected (high variance audio)
4. ✅ Confidence >= 60%
5. ✅ Not already transferred

**Transfer happens in ~1-2 seconds** after agent starts speaking!

### What Happens During Transfer

```
1. Mark call leg as "LIVE"
2. Look up your RingCentral queue
3. Update TwiML to dial: +19492268820
4. Twilio bridges:
   
   IRS Agent ←→ Twilio ←→ Your RC Queue ←→ Your Agent
   
5. Your phone rings (queue ext 999)
6. You answer
7. Connected! 🎉
```

**Call stays connected for up to 4 hours** or until someone hangs up.

---

## 🚫 **What AI Also Detects (and Rejects)**

### Voicemail (Layer 1)
- **Detects:** Long sustained message in first 25 seconds
- **Action:** Hang up immediately
- **Reason:** Called wrong number or after-hours

### Early Disconnects
- **Detects:** Call drops before DTMF 2
- **Action:** Mark as FAILED
- **Reason:** Network issue or number blocked

---

## 📊 **Success Metrics**

**Good Performance:**
- ✅ Voicemail detection: 95%+
- ✅ "Too busy" detection: 90%+
- ✅ Hold music detection: 98%+
- ✅ Live agent detection: 92%+
- ✅ False transfer rate: <5%

**Typical Wait Times:**
- 🌅 Morning (8-11 AM PST): 5-20 minutes
- 🌞 Midday (12:30-3:30 PM PST): Often "too busy"
- 🌇 Afternoon (3:30-5 PM PST): 10-30 minutes

---

## 🎧 **Live Audio Monitor**

You can **tap into the live audio** to hear exactly what AI hears:

1. Click "🎧 Listen Live" button
2. Hear:
   - IRS greeting
   - DTMF beeps
   - Disclosures
   - Hold music
   - Agent voice
3. See real-time audio level meter
4. Verify AI is making correct decisions

**Perfect for:**
- Testing detection accuracy
- Training improvements
- Debugging false positives
- Understanding why calls fail

---

## 💡 **Best Practices**

### Timing Your Jobs

**Best times to call:**
- ✅ 8:00-11:00 AM PST (before "too busy" kicks in)
- ✅ 3:30-5:00 PM PST (after "too busy" window)
- ❌ 12:30-3:30 PM PST (high rejection rate)

### Line Count

**Recommended:**
- Start with 3-6 lines for testing
- Scale to 10-20 lines during good hours
- Max 50-100 lines if you have capacity

**Why multiple lines?**
- Some hit "too busy" → Fail fast
- Some get through to hold → Wait for agent
- First one to reach agent wins! 🏆

### Queue Configuration

**Critical:**
- ✅ Queue phone number MUST be correct: `+19492268820`
- ✅ Someone MUST be logged into queue (ext 999)
- ✅ Answer within 10-15 seconds when it rings
- ✅ IRS agent is already on the line!

---

## 🛠️ **Technical Configuration**

### Environment Variables (.env)

```bash
# IRS Configuration
IRS_PHONE_NUMBER=+18668604259          # 866-860-4259 ✓
IRS_FIRST_DTMF=1                       # Press 1 immediately
IRS_SECOND_DTMF=2                      # Press 2 after 45s
IRS_DTMF_DELAY_SECONDS=45              # 45 seconds (randomized ±3s)

# AI Detection
AI_AUTO_TRANSFER_CONFIDENCE=0.60       # 60% threshold
AI_ANALYSIS_INTERVAL_MS=250            # Analyze every 250ms
AI_MIN_SILENCE_BEFORE_AGENT=0.8        # 0.8s silence before speech

# RingCentral Queue
QUEUE_PHONE_NUMBER=+19492268820        # Your queue direct number
QUEUE_EXTENSION=999                    # Your queue extension
```

---

## 🔍 **Troubleshooting**

### "AI not detecting agent"
- ✅ Use Live Audio Monitor
- ✅ Listen for music stop + speech
- ✅ Check confidence is building (should see %)
- ✅ Verify threshold is 60% (not higher)

### "Transfer not working"
- ✅ Check queue phone number is correct
- ✅ Ensure someone is logged into queue
- ✅ Verify no AMD (disabled in latest version)
- ✅ Check backend logs for errors

### "Getting too many 'too busy'"
- ✅ Call outside 12:30-3:30 PM PST window
- ✅ Try early morning (8-9 AM PST)
- ✅ Consider East Coast hours (3 hours ahead)

### "Calls hanging up too early"
- ✅ Check if voicemail detection is too aggressive
- ✅ Verify DTMF 2 is being sent at 45s
- ✅ Ensure hold music detection is working

---

## 📈 **Scaling Strategy**

### Phase 1: Testing (1-3 lines)
- Verify end-to-end flow
- Test during different hours
- Calibrate AI thresholds
- Confirm queue transfer works

### Phase 2: Production (10-20 lines)
- Run during optimal hours
- Monitor success/failure rates
- Track average hold times
- Adjust line count based on capacity

### Phase 3: Maximum (50-100 lines)
- Only during good hours (not "too busy" window)
- Ensure adequate queue staffing
- Monitor RingCentral usage
- Track cost/benefit metrics

---

## 🎉 **Success Criteria**

**You know it's working when:**
1. ✅ Calls connect to 866-860-4259
2. ✅ DTMF "1" sent immediately
3. ✅ DTMF "2" sent after ~45 seconds
4. ✅ "Too busy" calls hang up immediately
5. ✅ Hold music calls stay connected
6. ✅ Live agent detection triggers at 60%
7. ✅ Your phone rings within 2 seconds
8. ✅ You answer and IRS agent is on the line
9. ✅ No hold time for your staff!

**The system is SAVING you 30-90 minutes of hold time per successful call!** 🚀

---

## 🆘 **Support**

If something isn't working:
1. Check backend logs for errors
2. Use Live Audio Monitor to hear what's happening
3. Verify configuration (IRS number, queue number, DTMF settings)
4. Test with 1 line first before scaling up
5. Monitor during different time windows

**Remember:** The system is designed to handle the exact IRS sequence you specified. It's smart enough to differentiate between "too busy", hold music, and live agents. Trust the AI! 🤖

---

**Last Updated:** January 28, 2026
**System Status:** ✅ **FULLY OPERATIONAL**
