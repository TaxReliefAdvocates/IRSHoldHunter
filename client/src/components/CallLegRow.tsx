import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from './StatusBadge';

interface CallLeg {
  id: string;
  holdExtensionId: string;
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

interface DetectionResult {
  shouldTransfer: boolean;
  confidence: number;
  reason: string;
  strategiesPassed: string[];
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

function LiveDetectionIndicator({ leg }: { leg: CallLeg }) {
  const { data: detection } = useQuery<DetectionResult>({
    queryKey: ['detection', leg.id],
    queryFn: () => fetch(`/api/jobs/legs/${leg.id}/detection-status`).then(r => r.json()),
    refetchInterval: (leg.status === 'ANSWERED' || leg.status === 'HOLDING') ? 2000 : false,
    enabled: leg.status === 'ANSWERED' || leg.status === 'HOLDING'
  });

  if (!detection || leg.status === 'LIVE' || leg.status === 'TRANSFERRED' || leg.status === 'ENDED') {
    return null;
  }

  const confidencePercent = Math.round(detection.confidence * 100);
  const confidenceColor = 
    confidencePercent >= 70 ? 'text-green-600' :
    confidencePercent >= 40 ? 'text-yellow-600' : 'text-gray-500';

  return (
    <div className={`text-xs ${confidenceColor} mt-1`}>
      <div className="font-medium">Confidence: {confidencePercent}%</div>
      <div className="text-gray-500">{detection.strategiesPassed.join(', ') || 'Waiting...'}</div>
    </div>
  );
}

export function CallLegRow({ leg, jobId, isWinner, index }: CallLegRowProps) {
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    setIsLive(leg.status === 'LIVE' || leg.status === 'TRANSFERRED');
  }, [leg.status]);

  const confirmLive = useMutation({
    mutationFn: () => 
      fetch(`/api/jobs/${jobId}/legs/${leg.id}/confirm-live`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    }
  });

  const showConfirmButton = 
    (leg.status === 'ANSWERED' || leg.status === 'HOLDING') && 
    !isWinner &&
    !confirmLive.isPending;

  return (
    <tr className={isWinner ? 'bg-yellow-50' : ''}>
      <td className="px-4 py-3 text-sm text-gray-900">
        {index + 1}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-gray-600">
        {leg.holdExtensionId}
      </td>
      <td className="px-4 py-3 text-sm">
        <StatusBadge status={leg.status} isWinner={isWinner} />
        <LiveDetectionIndicator leg={leg} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatTimestamp(leg.holdStartedAt)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatTimestamp(leg.liveDetectedAt)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {calculateDuration(leg.holdStartedAt, leg.liveDetectedAt || leg.endedAt)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {leg.lastEventType || '-'}
      </td>
      <td className="px-4 py-3">
        {showConfirmButton && (
          <button
            onClick={() => confirmLive.mutate()}
            disabled={confirmLive.isPending}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs px-3 py-1 rounded font-medium transition-colors"
            title="Manually confirm this is a live agent"
          >
            ✓ Confirm Live
          </button>
        )}
        {confirmLive.isPending && (
          <span className="text-xs text-gray-500">Transferring...</span>
        )}
      </td>
    </tr>
  );
}
