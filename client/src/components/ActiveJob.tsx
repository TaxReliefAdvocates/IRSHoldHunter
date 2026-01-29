import { useJob } from '../hooks/useJob';
import { CallLegRow } from './CallLegRow';
import { StatusBadge } from './StatusBadge';
import { apiClient } from '../lib/api';

interface ActiveJobProps {
  jobId: string;
  onNewJob: () => void;
}

export function ActiveJob({ jobId, onNewJob }: ActiveJobProps) {
  const { data: job, isLoading, error } = useJob(jobId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading job data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Error loading job: {error.message}
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  const winner = job.callLegs.find((leg) => leg.id === job.winningLegId);

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Job Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Job Status</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {job.id}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">IRS Number:</span>
            <span className="ml-2 font-mono text-gray-900">{job.irsNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">Queue Number:</span>
            <span className="ml-2 font-mono text-gray-900">{job.queueNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">Started:</span>
            <span className="ml-2 text-gray-900">
              {new Date(job.startedAt).toLocaleString()}
            </span>
          </div>
          {job.transferredAt && (
            <div>
              <span className="text-gray-500">Transferred:</span>
              <span className="ml-2 text-gray-900">
                {new Date(job.transferredAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {winner && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="text-yellow-700 font-medium">
              🏆 Winner: Extension {winner.holdExtensionId}
            </span>
            {winner.liveDetectedAt && (
              <span className="ml-4 text-sm text-yellow-600">
                Detected at {new Date(winner.liveDetectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Call Legs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Call Legs ({job.callLegs.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Extension
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hold Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Live Detected
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Event
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {job.callLegs.map((leg, index) => (
            <CallLegRow
                  key={leg.id}
                  leg={leg}
                  isWinner={leg.id === job.winningLegId}
                  index={index}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={onNewJob}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Start New Hunt
        </button>
        
        {job.status === 'RUNNING' && (
          <button
            onClick={async () => {
              await apiClient(`/api/jobs/${job.id}/stop`, { method: 'POST' });
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Stop Job
          </button>
        )}
      </div>
    </div>
  );
}
