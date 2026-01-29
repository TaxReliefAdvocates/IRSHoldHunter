import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from './StatusBadge';
import { useSocket } from '../hooks/useSocket';
import { LiveAudioPlayer } from './LiveAudioPlayer';
import { apiClient } from '../lib/api';

interface CallLeg {
  id: string;
  holdExtensionId?: string;
  twilioCallSid?: string;
  status: string;
  holdStartedAt: string | null;
  liveDetectedAt: string | null;
  transferredAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  lastEventType: string | null;
}

interface CallLegRowProps {
  leg: CallLeg;
  jobId: string;
  isWinner: boolean;
  index: number;
}

interface AIDetectionStatus {
  legId: string;
  callSid: string;
  status: string;
  message: string;
  confidence: number;
  timestamp: number;
}

interface LogEntry {
  timestamp: string;
  callSid: string;
  legId: string;
  type: 'detection' | 'dtmf' | 'status' | 'transfer';
  message: string;
  data?: any;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function calculateDuration(start: string | null, end: string | null): string {
  if (!start) return '-';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const durationSeconds = Math.floor((endTime - startTime) / 1000);
  
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function CallLegRow({ leg, jobId, isWinner, index }: CallLegRowProps) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [aiStatus, setAiStatus] = useState<AIDetectionStatus | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Listen for AI detection updates via Socket.io
  useEffect(() => {
    if (!socket) return;
    
    const handleAIDetection = (data: AIDetectionStatus) => {
      if (data.legId === leg.id) {
        setAiStatus(data);
      }
    };
    
    const handleDetectionLog = (log: LogEntry) => {
      if (log.legId === leg.id) {
        setLogs(prev => [...prev.slice(-20), log]); // Keep last 20 logs per leg
      }
    };
    
    socket.on('ai-detection', handleAIDetection);
    socket.on('detection-log', handleDetectionLog);
    
    return () => {
      socket.off('ai-detection', handleAIDetection);
      socket.off('detection-log', handleDetectionLog);
    };
  }, [socket, leg.id]);

  const manualTransfer = useMutation({
    mutationFn: () =>
      apiClient(`/webhooks/twilio/trigger-transfer/${leg.twilioCallSid}`, {
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    }
  });

  const showManualTransfer = 
    (leg.status === 'ANSWERED' || leg.status === 'HOLDING') && 
    !isWinner &&
    leg.twilioCallSid &&
    !manualTransfer.isPending;

  const getLogColor = (type: string) => {
    switch (type) {
      case 'detection':
        return 'bg-blue-50 border-blue-200';
      case 'dtmf':
        return 'bg-purple-50 border-purple-200';
      case 'status':
        return 'bg-gray-50 border-gray-200';
      case 'transfer':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'detection':
        return '🔍';
      case 'dtmf':
        return '📱';
      case 'status':
        return '📊';
      case 'transfer':
        return '🚀';
      default:
        return '📝';
    }
  };

  return (
    <>
      <tr className={isWinner ? 'bg-yellow-50 border-l-4 border-l-yellow-500' : 'border-b hover:bg-gray-50'}>
      {/* Leg Number */}
      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
        {index + 1}
      </td>
      
      {/* Extension/Twilio ID */}
      <td className="px-4 py-3 text-sm">
        {leg.twilioCallSid ? (
          <div>
            <div className="font-mono text-blue-600">Twilio</div>
            <div className="text-xs text-gray-500 font-mono">{leg.twilioCallSid.slice(-8)}</div>
          </div>
        ) : (
          <div className="text-gray-400">N/A</div>
        )}
      </td>
      
      {/* Status with AI Detection */}
      <td className="px-4 py-3 text-sm">
        <div className="space-y-2">
          {/* Main Status Badge */}
          <div className="flex items-center gap-2">
            <StatusBadge status={leg.status} isWinner={isWinner} />
            {leg.status === 'ANSWERED' && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <span className="animate-pulse">🔵</span>
                <span className="font-medium">Live Streaming</span>
              </span>
            )}
          </div>
          
          {/* AI Detection Status */}
          {aiStatus && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                {aiStatus.status === 'hold_music' && <span>🎵</span>}
                {aiStatus.status === 'silence' && <span>🤫</span>}
                {aiStatus.status === 'detecting_agent' && <span className="animate-pulse">🎯</span>}
                {aiStatus.status === 'transferring' && <span>✅</span>}
                {aiStatus.status === 'too_busy' && <span>❌</span>}
                {aiStatus.status === 'voicemail' && <span>🤖</span>}
                <span className="font-medium">{aiStatus.message}</span>
              </div>
              
              {/* Confidence Bar */}
              {aiStatus.confidence > 0 && aiStatus.status !== 'voicemail' && aiStatus.status !== 'too_busy' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        aiStatus.confidence >= 0.6 ? 'bg-green-500 animate-pulse' :
                        aiStatus.confidence >= 0.3 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(aiStatus.confidence * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-bold w-12 ${
                    aiStatus.confidence >= 0.6 ? 'text-green-600' :
                    aiStatus.confidence >= 0.3 ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {Math.min(Math.round(aiStatus.confidence * 100), 100)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
      
      {/* Hold Started */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatTimestamp(leg.holdStartedAt)}
      </td>
      
      {/* Live Detected */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatTimestamp(leg.liveDetectedAt)}
      </td>
      
      {/* Duration */}
      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
        {calculateDuration(leg.holdStartedAt, leg.liveDetectedAt || leg.endedAt)}
      </td>
      
      {/* Last Event */}
      <td className="px-4 py-3 text-sm text-gray-500">
        {leg.lastEventType || '-'}
      </td>
      
      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Show Logs button */}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`text-xs px-2 py-1 rounded-md font-medium transition-all ${
              logs.length > 0 
                ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' 
                : 'bg-gray-100 text-gray-500'
            }`}
            title={`View AI detection logs for this call (${logs.length} events)`}
          >
            📊 {logs.length > 0 ? `${logs.length}` : 'Logs'}
          </button>
          
          {/* Listen to this leg */}
          {leg.status === 'ANSWERED' && leg.twilioCallSid && (
            <div className="flex-shrink-0">
              <LiveAudioPlayer 
                jobId={jobId} 
                legId={leg.id}
                compact={true}
              />
            </div>
          )}
          
          {/* Transfer button */}
          {showManualTransfer && (
            <button
              onClick={() => manualTransfer.mutate()}
              disabled={manualTransfer.isPending}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
              title="Transfer this call to your RingCentral queue"
            >
              {manualTransfer.isPending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <span>🎯</span>
                  <span>Transfer Now</span>
                </>
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
    
    {/* Expandable Logs Row */}
    {showLogs && (
      <tr>
        <td colSpan={8} className="px-4 py-4 bg-gray-50">
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                🤖 AI Detection Logs for Call #{index + 1}
              </h4>
              <button
                onClick={() => setLogs([])}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded"
              >
                Clear
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No logs yet. Waiting for AI detection events...
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded border ${getLogColor(log.type)}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base">{getLogIcon(log.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium">{log.message}</p>
                        {log.data && (
                          <pre className="text-xs mt-1 p-1 bg-black/5 rounded overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </td>
      </tr>
    )}
  </>
  );
}
