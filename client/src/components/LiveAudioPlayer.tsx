import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

interface LiveAudioPlayerProps {
  jobId: string;
  legId?: string; // Optional: listen to specific leg only
  compact?: boolean; // NEW: Compact mode for table rows
}

export function LiveAudioPlayer({ jobId, legId, compact = false }: LiveAudioPlayerProps) {
  const { socket } = useSocket();
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const nextPlayTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!socket) return;

    const handleAudioChunk = async (data: any) => {
      // Filter by leg if specified
      if (legId && data.legId !== legId) return;
      
      if (!isListening || !audioContextRef.current || !gainNodeRef.current) return;

      try {
        // Decode base64 audio (mulaw 8kHz from Twilio)
        const audioData = atob(data.audio);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }

        // Convert mulaw to linear PCM
        const pcmData = mulawToLinear(audioArray);
        
        // Add to queue
        audioQueueRef.current.push(pcmData);
        
        // Keep queue size reasonable (max 2 seconds of audio)
        if (audioQueueRef.current.length > 100) {
          audioQueueRef.current.shift();
        }
        
        // Start playback if not already playing
        if (!isPlayingRef.current) {
          playNextChunk();
        }

        // Update audio level visualization
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
      } catch (error) {
        console.error('Audio playback error:', error);
      }
    };

    const playNextChunk = () => {
      if (!audioContextRef.current || !gainNodeRef.current || !isListening) {
        isPlayingRef.current = false;
        return;
      }
      
      const chunk = audioQueueRef.current.shift();
      if (!chunk) {
        isPlayingRef.current = false;
        return;
      }

      isPlayingRef.current = true;
      const audioContext = audioContextRef.current;
      
      // Initialize play time on first chunk
      if (nextPlayTimeRef.current === 0) {
        nextPlayTimeRef.current = audioContext.currentTime + 0.05; // 50ms initial buffer
      }
      
      // Schedule this chunk
      const playTime = Math.max(audioContext.currentTime, nextPlayTimeRef.current);
      const chunkDuration = chunk.length / 8000; // 8kHz sample rate
      
      // Create and play audio buffer
      const audioBuffer = audioContext.createBuffer(1, chunk.length, 8000);
      audioBuffer.getChannelData(0).set(chunk);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current);
      source.start(playTime);
      
      // Update next play time
      nextPlayTimeRef.current = playTime + chunkDuration;
      
      // Schedule next chunk
      source.onended = () => {
        playNextChunk();
      };
    };

    socket.on('audio-chunk', handleAudioChunk);

    return () => {
      socket.off('audio-chunk', handleAudioChunk);
    };
  }, [socket, jobId, legId, isListening]);

  const startListening = () => {
    // Initialize Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gainNode = audioContext.createGain();
    const analyser = audioContext.createAnalyser();
    
    gainNode.gain.value = 2.5; // Balanced volume boost
    analyser.fftSize = 256;
    
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    gainNodeRef.current = gainNode;
    analyserRef.current = analyser;
    nextPlayTimeRef.current = 0; // Reset play time
    audioQueueRef.current = []; // Clear any old audio
    isPlayingRef.current = false;

    setIsListening(true);
  };

  const stopListening = () => {
    isPlayingRef.current = false; // Stop playback immediately
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      gainNodeRef.current = null;
      analyserRef.current = null;
    }
    
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    setIsListening(false);
    setAudioLevel(0);
  };

  // Compact mode for table rows
  if (compact) {
    return (
      <button
        onClick={isListening ? stopListening : startListening}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
        title={isListening ? 'Stop listening to this call' : 'Listen to this call live'}
      >
        {isListening ? '🔇' : '🎧'}
        {isListening && (
          <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  // Full mode for main section
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={isListening ? stopListening : startListening}
        className={`px-4 py-2 rounded-md font-medium transition-colors ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isListening ? '🔇 Stop Listening' : '🎧 Listen Live'}
      </button>

      {isListening && (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-gray-600 font-medium">Audio Level:</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{Math.round(audioLevel * 100)}%</span>
        </div>
      )}

      {isListening && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-600 font-medium">LIVE</span>
        </div>
      )}
    </div>
  );
}

// Mulaw to linear PCM conversion (ITU-T G.711)
// Build decode table (done once at module load)
const MULAW_DECODE_TABLE = (() => {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const mulawByte = ~i;
    const sign = (mulawByte & 0x80);
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0F;
    
    let sample = ((mantissa << 3) + 0x84) << exponent;
    if (sign !== 0) sample = -sample;
    
    table[i] = sample;
  }
  return table;
})();

function mulawToLinear(mulaw: Uint8Array): Float32Array {
  const linear = new Float32Array(mulaw.length);
  
  // Decode and normalize to -1.0 to 1.0
  for (let i = 0; i < mulaw.length; i++) {
    linear[i] = MULAW_DECODE_TABLE[mulaw[i]] / 32768.0;
  }

  return linear;
}

