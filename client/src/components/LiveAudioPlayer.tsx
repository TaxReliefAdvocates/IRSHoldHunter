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
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    const handleAudioChunk = async (data: any) => {
      // Filter by leg if specified
      if (legId && data.legId !== legId) return;
      
      if (!isListening || !audioContextRef.current) return;

      try {
        // Decode base64 audio (mulaw 8kHz from Twilio)
        const audioData = atob(data.audio);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }

        // Convert mulaw to linear PCM
        const pcmData = mulawToLinear(audioArray);
        
        // Resample from 8kHz to browser's sample rate (usually 48kHz)
        const targetSampleRate = audioContextRef.current.sampleRate;
        const resampledData = resample(pcmData, 8000, targetSampleRate);
        
        // Add to queue
        audioQueueRef.current.push(resampledData);
        
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
      if (!audioContextRef.current || !gainNodeRef.current) return;
      
      const chunk = audioQueueRef.current.shift();
      if (!chunk) {
        isPlayingRef.current = false;
        return;
      }

      isPlayingRef.current = true;
      
      const audioContext = audioContextRef.current;
      const currentTime = audioContext.currentTime;
      
      // Schedule next chunk right after this one (no gaps)
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      const duration = chunk.length / audioContext.sampleRate;
      nextStartTimeRef.current = startTime + duration;
      
      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(1, chunk.length, audioContext.sampleRate);
      audioBuffer.getChannelData(0).set(chunk);

      // Play the audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current);
      source.start(startTime);
      
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
    
    gainNode.gain.value = 2.0; // Boost volume 2x
    analyser.fftSize = 256;
    
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    gainNodeRef.current = gainNode;
    analyserRef.current = analyser;
    nextStartTimeRef.current = audioContext.currentTime;

    setIsListening(true);
  };

  const stopListening = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      gainNodeRef.current = null;
      analyserRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
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

// Simple linear resampler
function resample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const frac = srcIndex - srcIndexFloor;
    
    // Linear interpolation
    output[i] = input[srcIndexFloor] * (1 - frac) + input[srcIndexCeil] * frac;
  }
  
  return output;
}
