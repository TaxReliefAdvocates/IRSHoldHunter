import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface DestinationConfig {
  id: string;
  name: string;
  phoneNumber: string;
  description?: string;
  category?: string;
  recommendedLineCount?: number;
  isDefault: boolean;
  isActive: boolean;
  tags: string[];
  lastUsed?: string;
}

interface DestinationSelectorProps {
  selectedDestinationId?: string;
  onSelect: (destinationId: string) => void;
  onLineCountSuggestion?: (count: number) => void;
}

export function DestinationSelector({ 
  selectedDestinationId, 
  onSelect,
  onLineCountSuggestion 
}: DestinationSelectorProps) {
  const queryClient = useQueryClient();

  const { data: destinations, isLoading } = useQuery({
    queryKey: ['destinations', { activeOnly: true }],
    queryFn: () => apiClient('/api/destinations?active=true').then(r => r.json())
  });

  const { data: defaultDestination } = useQuery({
    queryKey: ['default-destination'],
    queryFn: () => apiClient('/api/destinations/default').then(r => r.json()).catch(() => null)
  });

  const selectedDestination = destinations?.find((d: DestinationConfig) => d.id === selectedDestinationId);
  const effectiveDestination = selectedDestination || defaultDestination;

  // Auto-suggest line count when destination changes
  if (effectiveDestination?.recommendedLineCount && onLineCountSuggestion) {
    setTimeout(() => onLineCountSuggestion(effectiveDestination.recommendedLineCount!), 0);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Call Destination Number:
      </label>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading destinations...</div>
      ) : (
        <>
          <select
            value={selectedDestinationId || defaultDestination?.id || ''}
            onChange={e => onSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {!destinations || destinations.length === 0 ? (
              <option value="">No destinations - Go to Settings</option>
            ) : (
              <>
                <option value="">Use default destination</option>
                {destinations.map((destination: DestinationConfig) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name} ({destination.phoneNumber})
                    {destination.isDefault && ' ⭐ Default'}
                  </option>
                ))}
              </>
            )}
          </select>

          <div className="flex items-center gap-4">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // Navigate to settings
                window.location.hash = 'settings';
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Manage Destinations →
            </a>
          </div>

          {effectiveDestination && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-700">
                <div><strong>Calling:</strong> {effectiveDestination.name}</div>
                <div className="font-mono text-xs text-gray-600 mt-1">
                  {effectiveDestination.phoneNumber}
                </div>
                {effectiveDestination.description && (
                  <div className="text-xs text-gray-500 mt-1">
                    {effectiveDestination.description}
                  </div>
                )}
                {effectiveDestination.recommendedLineCount && (
                  <div className="text-xs text-blue-600 mt-1">
                    💡 Recommended: {effectiveDestination.recommendedLineCount} lines
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedDestinationId && defaultDestination && (
            <div className="text-xs text-gray-500">
              Using default: {defaultDestination.name}
            </div>
          )}

          {(!destinations || destinations.length === 0) && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              ⚠️ No destinations configured. Go to Settings to add phone numbers to call.
            </div>
          )}
        </>
      )}
    </div>
  );
}
