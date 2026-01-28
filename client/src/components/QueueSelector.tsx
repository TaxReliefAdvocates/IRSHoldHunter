import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface QueueConfig {
  id: string;
  name: string;
  phoneNumber: string;
  extensionNumber: string;
  isDefault: boolean;
  tags: string[];
  lastUsed?: string;
}

interface QueueSelectorProps {
  selectedQueueId?: string;
  onSelect: (queueId: string) => void;
}

export function QueueSelector({ selectedQueueId, onSelect }: QueueSelectorProps) {
  const queryClient = useQueryClient();

  const { data: queues, isLoading } = useQuery({
    queryKey: ['queues'],
    queryFn: () => fetch('/api/queues').then(r => r.json())
  });

  const { data: defaultQueue } = useQuery({
    queryKey: ['default-queue'],
    queryFn: () => fetch('/api/queues/default').then(r => r.json()).catch(() => null)
  });

  const syncQueues = useMutation({
    mutationFn: () => fetch('/api/queues/sync', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['default-queue'] });
    }
  });

  const selectedQueue = queues?.find((q: QueueConfig) => q.id === selectedQueueId);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Transfer To Call Queue:
      </label>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading queues...</div>
      ) : (
        <>
          <select
            value={selectedQueueId || defaultQueue?.id || ''}
            onChange={e => onSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {!queues || queues.length === 0 ? (
              <option value="">No queues available - Click Sync</option>
            ) : (
              <>
                <option value="">Use default queue</option>
                {queues.map((queue: QueueConfig) => (
                  <option key={queue.id} value={queue.id}>
                    {queue.name} (Ext: {queue.extensionNumber})
                    {queue.isDefault && ' ⭐ Default'}
                  </option>
                ))}
              </>
            )}
          </select>

          <div className="flex items-center gap-4">
            <button
              onClick={() => syncQueues.mutate()}
              disabled={syncQueues.isPending}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              {syncQueues.isPending ? '🔄 Syncing...' : '🔄 Sync Queues from RingCentral'}
            </button>

            {queues && queues.length > 0 && (
              <a
                href="/queues"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Manage Queues →
              </a>
            )}
          </div>

          {selectedQueue && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-700">
                <div><strong>Queue:</strong> {selectedQueue.name}</div>
                <div className="font-mono text-xs text-gray-600 mt-1">
                  {selectedQueue.phoneNumber}
                </div>
              </div>
            </div>
          )}

          {!selectedQueueId && defaultQueue && (
            <div className="text-xs text-gray-500">
              Using default: {defaultQueue.name}
            </div>
          )}

          {!queues || queues.length === 0 ? (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              ⚠️ No queues found. Click "Sync Queues" to load from RingCentral.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
