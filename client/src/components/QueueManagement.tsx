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

export function QueueManagement() {
  const queryClient = useQueryClient();

  const { data: queues, isLoading } = useQuery({
    queryKey: ['queues'],
    queryFn: () => fetch('/api/queues').then(r => r.json())
  });

  const { data: stats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => fetch('/api/queues/stats').then(r => r.json())
  });

  const syncQueues = useMutation({
    mutationFn: () => fetch('/api/queues/sync', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    }
  });

  const setDefault = useMutation({
    mutationFn: (queueId: string) =>
      fetch(`/api/queues/${queueId}/set-default`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['default-queue'] });
    }
  });

  if (isLoading) {
    return <div className="p-4">Loading queues...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Call Queue Management</h1>
          <button
            onClick={() => syncQueues.mutate()}
            disabled={syncQueues.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {syncQueues.isPending ? 'Syncing...' : '🔄 Sync from RingCentral'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Queues</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{stats.withPhoneNumber}</div>
              <div className="text-sm text-gray-600">With Phone Number</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{stats.default || 'None'}</div>
              <div className="text-sm text-gray-600">Default Queue</div>
            </div>
          </div>
        )}

        {!queues || queues.length === 0 ? (
          <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
            <h3 className="text-lg font-medium text-yellow-900 mb-2">
              No Queues Found
            </h3>
            <p className="text-yellow-700 mb-4">
              Click "Sync from RingCentral" to load your call queues.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Extension
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Phone Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Default
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Used
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {queues.map((queue: QueueConfig) => (
                  <tr key={queue.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {queue.name}
                      {queue.tags && queue.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {queue.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {queue.extensionNumber}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {queue.phoneNumber || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {queue.isDefault ? (
                        <span className="text-green-600 font-medium">⭐ Default</span>
                      ) : (
                        <button
                          onClick={() => setDefault.mutate(queue.id)}
                          disabled={setDefault.isPending}
                          className="text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
                        >
                          Set as Default
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {queue.lastUsed
                        ? new Date(queue.lastUsed).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 About Call Queues</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Call queues are where successful IRS calls will be transferred</li>
          <li>• Set a default queue to use automatically when starting jobs</li>
          <li>• Phone numbers are fetched from RingCentral and used for transfers</li>
          <li>• Sync regularly to keep queue information up-to-date</li>
        </ul>
      </div>
    </div>
  );
}
