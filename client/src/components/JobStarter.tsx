import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueueSelector } from './QueueSelector';

interface JobStarterProps {
  onJobStarted: (jobId: string) => void;
}

interface Extension {
  id: string;
  extensionNumber: string;
  name: string;
  enabledForHunting: boolean;
  currentJobId?: string;
}

export function JobStarter({ onJobStarted }: JobStarterProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(6);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>();
  const [selectedQueueId, setSelectedQueueId] = useState<string>();
  const [poolName, setPoolName] = useState<string>('');
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: destinations } = useQuery({
    queryKey: ['destinations', { active: true }],
    queryFn: () => fetch('/api/destinations?active=true').then(r => r.json())
  });

  const { data: defaultDestination } = useQuery({
    queryKey: ['default-destination'],
    queryFn: () => fetch('/api/destinations/default').then(r => r.json()).catch(() => null)
  });

  const { data: pools } = useQuery({
    queryKey: ['extension-pools'],
    queryFn: () => fetch('/api/extensions/pools').then(r => r.json())
  });

  const { data: availableExtensions } = useQuery({
    queryKey: ['available-extensions'],
    queryFn: () => fetch('/api/extensions?enabled=true&available=true').then(r => r.json())
  });

  const { data: stats } = useQuery({
    queryKey: ['extension-stats'],
    queryFn: () => fetch('/api/extensions/stats').then(r => r.json())
  });

  // Auto-adjust lineCount when available extensions change
  useEffect(() => {
    const maxAvailable = stats?.available || 0;
    if (maxAvailable > 0 && lineCount > maxAvailable) {
      setLineCount(maxAvailable);
    }
  }, [stats?.available]);

  const startJob = async () => {
    try {
      setIsStarting(true);
      setError(null);

      const effectiveDestinationId = selectedDestinationId || defaultDestination?.id;
      
      if (!effectiveDestinationId) {
        setError('Please configure a destination number in Settings');
        setIsStarting(false);
        return;
      }

      const payload: any = {
        destinationId: effectiveDestinationId,
        lineCount,
        queueId: selectedQueueId || undefined
      };

      if (selectedExtensions.length > 0) {
        payload.specificExtensionIds = selectedExtensions;
      } else if (poolName) {
        payload.poolName = poolName;
      }

      const response = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start job');
      }

      const data = await response.json();
      onJobStarted(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
      setIsStarting(false);
    }
  };

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

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
              <div className="text-sm text-gray-600">Enabled</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.available}</div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <div className="text-2xl font-bold text-red-600">{stats.inUse}</div>
              <div className="text-sm text-gray-600">In Use</div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow">
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
                  <option value="">Use default destination</option>
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
                {destinations?.find((d: any) => d.id === (selectedDestinationId || defaultDestination?.id))?.description && (
                  <div className="text-xs text-gray-500 mt-1">
                    {destinations.find((d: any) => d.id === (selectedDestinationId || defaultDestination?.id))?.description}
                  </div>
                )}
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

          {/* Basic Settings */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Lines:
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max={Math.min(70, stats?.available || 70)}
                value={lineCount}
                onChange={e => setLineCount(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-2xl font-bold text-blue-600 w-12 text-center">
                {lineCount}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.available || 0} extensions available
            </p>
          </div>

          {/* Extension Pool Selection */}
          {pools && pools.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extension Pool (Optional):
              </label>
              <select
                value={poolName}
                onChange={e => {
                  setPoolName(e.target.value);
                  if (e.target.value) setSelectedExtensions([]);
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Auto-select available extensions</option>
                {pools.map((name: string) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Advanced Options */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              {showAdvanced ? '▼' : '▶'} Advanced: Manual Extension Selection
            </button>

            {showAdvanced && availableExtensions && availableExtensions.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-3">
                  Select specific extensions (overrides pool selection):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {availableExtensions.map((ext: Extension) => (
                    <label
                      key={ext.id}
                      className="flex items-center gap-2 p-2 bg-white rounded hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedExtensions.includes(ext.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedExtensions([...selectedExtensions, ext.id]);
                            setPoolName(''); // Clear pool selection
                          } else {
                            setSelectedExtensions(selectedExtensions.filter(id => id !== ext.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        <span className="font-mono">{ext.extensionNumber}</span> - {ext.name}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedExtensions.length > 0 && (
                  <p className="text-sm text-blue-600 mt-2">
                    {selectedExtensions.length} extension(s) selected
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={startJob}
            disabled={isStarting || lineCount < 1 || (stats?.available || 0) < lineCount || !destinations || destinations.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-lg disabled:cursor-not-allowed"
          >
            {!destinations || destinations.length === 0
              ? 'Configure Destination in Settings First'
              : isStarting
              ? 'Starting Hunt...'
              : (stats?.available || 0) < lineCount
              ? `Only ${stats?.available || 0} extension${stats?.available !== 1 ? 's' : ''} available - need ${lineCount}`
              : `Start Hunt with ${lineCount} Line${lineCount !== 1 ? 's' : ''}`
            }
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {(stats?.available || 0) < lineCount && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              ⚠️ Not enough available extensions. Need {lineCount}, have {stats?.available || 0}.
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a
            href="/extensions"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Manage Extensions →
          </a>
        </div>
      </div>
    </div>
  );
}
