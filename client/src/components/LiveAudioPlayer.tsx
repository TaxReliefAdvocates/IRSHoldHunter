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
        
        // Create audio buffer at target sample rate
        const audioBuffer = audioContextRef.current.createBuffer(
          1, // mono
          resampledData.length,
          targetSampleRate
        );
        
        audioBuffer.getChannelData(0).set(resampledData);

        // Play the audio
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current!);
        source.start();

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

    setIsListening(true);
  };

  const stopListening = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      gainNodeRef.current = null;
      analyserRef.current = null;
    }
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

// Mulaw to linear PCM conversion
function mulawToLinear(mulaw: Uint8Array): Float32Array {
  const linear = new Float32Array(mulaw.length);
  const MULAW_BIAS = 0x84;
  const MULAW_MAX = 0x1FFF;

  for (let i = 0; i < mulaw.length; i++) {
    let mulawByte = ~mulaw[i];
    let sign = (mulawByte & 0x80) !== 0;
    let exponent = (mulawByte >> 4) & 0x07;
    let mantissa = mulawByte & 0x0F;
    
    let sample = mantissa << (exponent + 3);
    sample += MULAW_BIAS;
    sample <<= exponent;
    
    if (sign) sample = -sample;
    
    // Normalize to -1.0 to 1.0
    linear[i] = sample / MULAW_MAX;
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
