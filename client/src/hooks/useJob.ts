import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSocket } from './useSocket';

interface CallLeg {
  id: string;
  jobId: string;
  holdExtensionId: string;
  telephonySessionId: string | null;
  partyId: string | null;
  status: string;
  holdStartedAt: string | null;
  liveDetectedAt: string | null;
  transferredAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  lastEventType: string | null;
}

interface Job {
  id: string;
  status: string;
  irsNumber: string;
  queueNumber: string;
  winningLegId: string | null;
  startedAt: string;
  transferredAt: string | null;
  stoppedAt: string | null;
  callLegs: CallLeg[];
}

async function fetchJob(jobId: string): Promise<Job> {
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch job');
  }
  return response.json();
}

export function useJob(jobId: string | null) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: !!jobId,
    refetchInterval: 5000, // Poll every 5 seconds as backup
  });

  useEffect(() => {
    if (!socket || !jobId) return;

    // Subscribe to job updates
    socket.emit('subscribe:job', jobId);

    // Handle real-time updates
    const handleLegUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    };

    const handleJobTransferred = () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    };

    const handleJobStopped = () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    };

    socket.on('leg:updated', handleLegUpdate);
    socket.on('job:transferred', handleJobTransferred);
    socket.on('job:stopped', handleJobStopped);

    return () => {
      socket.emit('unsubscribe:job', jobId);
      socket.off('leg:updated', handleLegUpdate);
      socket.off('job:transferred', handleJobTransferred);
      socket.off('job:stopped', handleJobStopped);
    };
  }, [socket, jobId, queryClient]);

  return query;
}
