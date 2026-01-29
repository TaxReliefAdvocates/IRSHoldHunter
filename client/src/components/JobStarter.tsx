import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { QueueSelector } from './QueueSelector';

interface JobStarterProps {
  onJobStarted: (jobId: string) => void;
}

export function JobStarter({ onJobStarted }: JobStarterProps) {
  const [lineCount, setLineCount] = useState(6);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>();
  const [selectedQueueId, setSelectedQueueId] = useState<string>();

  const { data: destinations } = useQuery({
    queryKey: ['destinations', { active: true }],
    queryFn: () => fetch('/api/destinations?active=true').then(r => r.json())
  });

  const { data: defaultDestination } = useQuery({
    queryKey: ['default-destination'],
    queryFn: () => fetch('/api/destinations/default').then(r => r.json()).catch(() => null)
  });

  const startJobMutation = useMutation({
    mutationFn: async () => {
      const effectiveDestinationId = selectedDestinationId || defaultDestination?.id;
      
      if (!effectiveDestinationId) {
        throw new Error('Please configure a destination number in Settings');
      }

      const response = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId: effectiveDestinationId,
          lineCount,
          queueId: selectedQueueId || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start job');
      }

      const data = await response.json();
      return data.jobId;
    },
    onSuccess: (jobId) => {
      onJobStarted(jobId);
    }
  });

  return (
    <div className="py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            IRS Hold Hunter
          </h1>
          <p className="text-gray-600">
            Place concurrent calls to IRS and transfer the first one that reaches a live agent.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          {/* Twilio Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">☁️</span>
              <div>
                <div className="font-semibold text-blue-900 text-lg">Powered by Twilio</div>
                <div className="text-sm text-blue-700">
                  No device limits • Scale to 50+ lines • Cloud-based reliability
                </div>
              </div>
            </div>
          </div>

          {/* Destination Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call Destination Number:
            </label>
            <select
              value={selectedDestinationId || defaultDestination?.id || ''}
              onChange={e => setSelectedDestinationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {!destinations || destinations.length === 0 ? (
                <option value="">No destinations configured</option>
              ) : (
                <>
                  {destinations.map((dest: any) => (
                    <option key={dest.id} value={dest.id}>
                      {dest.name} ({dest.phoneNumber})
                      {dest.isDefault && ' ⭐ Default'}
                    </option>
                  ))}
                </>
              )}
            </select>

            {!destinations || destinations.length === 0 ? (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                ⚠️ No destinations configured.{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = '/'; window.location.hash = 'settings'; }} className="text-blue-600 hover:underline">
                  Go to Settings
                </a>
                {' '}to add phone numbers.
              </div>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-700">
                  <strong>Will call:</strong>{' '}
                  {destinations?.find((d: any) => d.id === (selectedDestinationId || defaultDestination?.id))?.phoneNumber || 'Select destination'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Your phone for testing
                </div>
              </div>
            )}
          </div>

          {/* Queue Selection */}
          <div className="mb-6">
            <QueueSelector
              selectedQueueId={selectedQueueId}
              onSelect={setSelectedQueueId}
            />
          </div>

          {/* Line Count Slider */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Lines (Twilio):
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="50"
                value={lineCount}
                onChange={e => setLineCount(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-3xl font-bold text-blue-600 min-w-[3rem] text-right">
                {lineCount}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>1 line</span>
              <span className="font-medium text-blue-600">No device limits with Twilio! Scale up to 50+ concurrent lines.</span>
              <span>50 lines</span>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={() => startJobMutation.mutate()}
            disabled={startJobMutation.isPending || lineCount < 1 || !destinations || destinations.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all text-lg disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
          >
            {!destinations || destinations.length === 0
              ? '⚙️ Configure Destination in Settings First'
              : startJobMutation.isPending
              ? '⏳ Starting Hunt...'
              : `🚀 Start Hunt with ${lineCount} Line${lineCount !== 1 ? 's' : ''} (Twilio)`
            }
          </button>

          {startJobMutation.isSuccess && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <span>✅</span>
                <span>Hunt started successfully with Twilio!</span>
              </div>
              <div className="text-sm text-green-700 mt-1">
                AI will detect live agents and auto-transfer to your queue.
              </div>
            </div>
          )}

          {startJobMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 font-medium">
                <span>❌</span>
                <span>Failed to start job</span>
              </div>
              <div className="text-sm text-red-700 mt-1">
                {(startJobMutation.error as Error)?.message || 'Unknown error'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
