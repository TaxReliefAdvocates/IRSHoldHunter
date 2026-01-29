import { useState, useEffect } from 'react';
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
  createdAt: string;
}

interface QueueConfig {
  id: string;
  name: string;
  phoneNumber: string;
  extensionNumber: string;
  isDefault: boolean;
  tags: string[];
  lastUsed?: string;
}

interface SystemSettings {
  dtmf1Delay: number;
  dtmf1Digit: string;
  dtmf2Delay: number;
  dtmf2Digit: string;
  updatedAt: string;
}

export function Settings() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    description: '',
    category: 'IRS',
    recommendedLineCount: 6,
    isDefault: false,
    isActive: true,
    tags: [] as string[]
  });

  const { data: destinations, isLoading } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => apiClient('/api/destinations').then(r => r.json())
  });

  const { data: stats } = useQuery({
    queryKey: ['destination-stats'],
    queryFn: () => apiClient('/api/destinations/stats').then(r => r.json())
  });

  const { data: queues, isLoading: queuesLoading } = useQuery({
    queryKey: ['queues'],
    queryFn: () => apiClient('/api/queues').then(r => r.json())
  });

  const { data: systemSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => apiClient('/api/settings').then(r => r.json())
  });

  const [editingQueue, setEditingQueue] = useState<string | null>(null);
  const [queuePhoneNumber, setQueuePhoneNumber] = useState('');
  
  const [dtmfSettings, setDtmfSettings] = useState({
    dtmf1Delay: 15,
    dtmf1Digit: '1',
    dtmf2Delay: 250,
    dtmf2Digit: '2'
  });

  const createDestination = useMutation({
    mutationFn: (data: any) =>
      apiClient('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      queryClient.invalidateQueries({ queryKey: ['destination-stats'] });
      setShowForm(false);
      setFormData({
        name: '',
        phoneNumber: '',
        description: '',
        category: 'IRS',
        recommendedLineCount: 6,
        isDefault: false,
        isActive: true,
        tags: []
      });
    }
  });

  const setDefault = useMutation({
    mutationFn: (destinationId: string) =>
      apiClient(`/api/destinations/${destinationId}/set-default`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      queryClient.invalidateQueries({ queryKey: ['default-destination'] });
    }
  });

  const toggleActive = useMutation({
    mutationFn: (dest: DestinationConfig) =>
      apiClient(`/api/destinations/${dest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !dest.isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
    }
  });

  const deleteDestination = useMutation({
    mutationFn: (destinationId: string) =>
      apiClient(`/api/destinations/${destinationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
    }
  });

  const updateQueuePhone = useMutation({
    mutationFn: ({ queueId, phoneNumber }: { queueId: string; phoneNumber: string }) =>
      apiClient(`/api/queues/${queueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      setEditingQueue(null);
      setQueuePhoneNumber('');
    }
  });

  const updateSystemSettings = useMutation({
    mutationFn: (settings: Partial<SystemSettings>) =>
      apiClient('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setDtmfSettings(data); // Update local state with saved values
    }
  });

  // Update local state when settings load from server
  useEffect(() => {
    if (systemSettings) {
      setDtmfSettings(systemSettings);
    }
  }, [systemSettings]);

  if (isLoading) {
    return <div className="p-4">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Destinations</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{stats.default || 'None'}</div>
              <div className="text-sm text-gray-600">Default Destination</div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">💡 About Destinations</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Destinations are phone numbers your system will call</li>
            <li>• Set a default destination to use automatically when starting jobs</li>
            <li>• Common destinations: IRS (+18008291040), Customer Support, Test Numbers</li>
            <li>• You can have multiple destinations for different scenarios</li>
          </ul>
        </div>

        {/* Add Destination Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Add New Destination
          </button>
        )}

        {/* Add Destination Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Add New Destination</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="IRS Main Line"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone Number * (E.164 format)</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+18008291040"
                  className="w-full px-3 py-2 border rounded font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Format: +1234567890</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="IRS main phone line for hold hunting"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="IRS">IRS</option>
                    <option value="Support">Customer Support</option>
                    <option value="Sales">Sales</option>
                    <option value="Testing">Testing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Recommended Lines</label>
                  <input
                    type="number"
                    min="1"
                    max="70"
                    value={formData.recommendedLineCount}
                    onChange={e => setFormData({ ...formData, recommendedLineCount: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                  <span className="text-sm">Set as default destination</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span className="text-sm">Active (available for selection)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => createDestination.mutate(formData)}
                  disabled={!formData.name || !formData.phoneNumber || createDestination.isPending}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createDestination.isPending ? 'Saving...' : 'Save Destination'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Destinations Table */}
        {destinations && destinations.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Phone Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rec. Lines
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Default
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {destinations.map((dest: DestinationConfig) => (
                  <tr key={dest.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {dest.name}
                      {dest.description && (
                        <div className="text-xs text-gray-500">{dest.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {dest.phoneNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="inline-block px-2 py-1 text-xs bg-gray-100 rounded">
                        {dest.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {dest.recommendedLineCount || 6}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleActive.mutate(dest)}
                        disabled={toggleActive.isPending}
                        className={`text-xs px-2 py-1 rounded ${
                          dest.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {dest.isActive ? '🟢 Active' : '⚪ Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {dest.isDefault ? (
                        <span className="text-green-600 font-medium">⭐ Default</span>
                      ) : (
                        <button
                          onClick={() => setDefault.mutate(dest.id)}
                          disabled={setDefault.isPending}
                          className="text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
                        >
                          Set as Default
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {dest.lastUsed
                        ? new Date(dest.lastUsed).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${dest.name}?`)) {
                            deleteDestination.mutate(dest.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {destinations && destinations.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <div className="text-4xl mb-4">📞</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Destinations Configured
            </h3>
            <p className="text-gray-600 mb-6">
              Add phone numbers you want to call (e.g., IRS, customer support lines)
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              + Add Your First Destination
            </button>
          </div>
        )}
      </div>

      {/* Quick Add Presets */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Add Common Destinations:</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setFormData({
                name: 'IRS Main Line',
                phoneNumber: '+18008291040',
                description: 'IRS main phone number',
                category: 'IRS',
                recommendedLineCount: 6,
                isDefault: true,
                isActive: true,
                tags: ['IRS', 'Government']
              });
              setShowForm(true);
            }}
            className="p-3 bg-white border border-gray-300 rounded text-sm text-left hover:bg-gray-50"
          >
            <div className="font-medium">IRS Main Line</div>
            <div className="text-xs text-gray-500">+18008291040</div>
          </button>

          <button
            onClick={() => {
              setFormData({
                name: 'Test - My Phone',
                phoneNumber: '+1',
                description: 'Your phone for testing',
                category: 'Testing',
                recommendedLineCount: 1,
                isDefault: false,
                isActive: true,
                tags: ['Test']
              });
              setShowForm(true);
            }}
            className="p-3 bg-white border border-gray-300 rounded text-sm text-left hover:bg-gray-50"
          >
            <div className="font-medium">Test Number</div>
            <div className="text-xs text-gray-500">Your phone (for testing)</div>
          </button>
        </div>
      </div>

      {/* Transfer Queue Settings */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">IRS Call Flow Settings</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">⌨️ DTMF Button Press Timing</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Configure when the system automatically presses buttons during IRS calls</li>
            <li>• DTMF 1 Delay: Seconds to wait before pressing first button (usually "1" for English)</li>
            <li>• DTMF 2 Delay: Additional seconds to wait AFTER button 1 before pressing button 2</li>
            <li>• Total time = DTMF 1 Delay + DTMF 2 Delay</li>
          </ul>
        </div>

        {settingsLoading ? (
          <div className="text-gray-500">Loading settings...</div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DTMF 1 - First Button
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Button to Press</label>
                    <input
                      type="text"
                      value={dtmfSettings.dtmf1Digit}
                      onChange={(e) => setDtmfSettings({ ...dtmfSettings, dtmf1Digit: e.target.value })}
                      maxLength={1}
                      className="w-20 px-3 py-2 border rounded font-mono text-center"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Delay (seconds)</label>
                    <input
                      type="number"
                      value={dtmfSettings.dtmf1Delay}
                      onChange={(e) => setDtmfSettings({ ...dtmfSettings, dtmf1Delay: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={600}
                      className="w-32 px-3 py-2 border rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Pressed at {dtmfSettings.dtmf1Delay}s ({Math.floor(dtmfSettings.dtmf1Delay / 60)}:{String(dtmfSettings.dtmf1Delay % 60).padStart(2, '0')})
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DTMF 2 - Second Button
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Button to Press</label>
                    <input
                      type="text"
                      value={dtmfSettings.dtmf2Digit}
                      onChange={(e) => setDtmfSettings({ ...dtmfSettings, dtmf2Digit: e.target.value })}
                      maxLength={1}
                      className="w-20 px-3 py-2 border rounded font-mono text-center"
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Delay After DTMF 1 (seconds)</label>
                    <input
                      type="number"
                      value={dtmfSettings.dtmf2Delay}
                      onChange={(e) => setDtmfSettings({ ...dtmfSettings, dtmf2Delay: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={600}
                      className="w-32 px-3 py-2 border rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Total: {dtmfSettings.dtmf1Delay + dtmfSettings.dtmf2Delay}s ({Math.floor((dtmfSettings.dtmf1Delay + dtmfSettings.dtmf2Delay) / 60)}:{String((dtmfSettings.dtmf1Delay + dtmfSettings.dtmf2Delay) % 60).padStart(2, '0')})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              {systemSettings && (
                <div className="bg-green-50 border border-green-200 p-4 rounded mb-4">
                  <h4 className="text-sm font-medium text-green-900 mb-2">✅ Current Saved Settings:</h4>
                  <div className="text-sm text-green-800 space-y-1 font-mono">
                    <div>DTMF 1: Press "{systemSettings.dtmf1Digit}" at {systemSettings.dtmf1Delay}s ({Math.floor(systemSettings.dtmf1Delay / 60)}:{String(systemSettings.dtmf1Delay % 60).padStart(2, '0')})</div>
                    <div>DTMF 2: Press "{systemSettings.dtmf2Digit}" at {systemSettings.dtmf1Delay + systemSettings.dtmf2Delay}s ({Math.floor((systemSettings.dtmf1Delay + systemSettings.dtmf2Delay) / 60)}:{String((systemSettings.dtmf1Delay + systemSettings.dtmf2Delay) % 60).padStart(2, '0')})</div>
                    <div className="text-xs text-green-600 mt-2">Last updated: {new Date(systemSettings.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded mb-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Timeline Preview (Pending Changes):</h4>
                <div className="text-sm text-gray-700 space-y-1 font-mono">
                  <div>🔹 00:00 - Call connects</div>
                  <div>🔹 {Math.floor(dtmfSettings.dtmf1Delay / 60)}:{String(dtmfSettings.dtmf1Delay % 60).padStart(2, '0')} - Press "{dtmfSettings.dtmf1Digit}" (DTMF 1)</div>
                  <div>🔹 {Math.floor((dtmfSettings.dtmf1Delay + dtmfSettings.dtmf2Delay) / 60)}:{String((dtmfSettings.dtmf1Delay + dtmfSettings.dtmf2Delay) % 60).padStart(2, '0')} - Press "{dtmfSettings.dtmf2Digit}" (DTMF 2)</div>
                  <div>🔹 Start listening for live agent...</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Validate before saving
                    if (dtmfSettings.dtmf1Delay < 0 || dtmfSettings.dtmf1Delay > 600) {
                      alert('DTMF 1 delay must be between 0 and 600 seconds');
                      return;
                    }
                    if (dtmfSettings.dtmf2Delay < 0 || dtmfSettings.dtmf2Delay > 600) {
                      alert('DTMF 2 delay must be between 0 and 600 seconds');
                      return;
                    }
                    if (!dtmfSettings.dtmf1Digit || !dtmfSettings.dtmf2Digit) {
                      alert('Both DTMF digits must be set');
                      return;
                    }
                    updateSystemSettings.mutate(dtmfSettings);
                  }}
                  disabled={updateSystemSettings.isPending}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {updateSystemSettings.isPending ? 'Saving...' : 'Save DTMF Settings'}
                </button>

                <button
                  onClick={() => {
                    const confirmed = confirm('Reset to recommended defaults?\n\nDTMF 1: "1" at 15s\nDTMF 2: "2" at 250s (4:25 total)');
                    if (confirmed) {
                      const defaults = {
                        dtmf1Delay: 15,
                        dtmf1Digit: '1',
                        dtmf2Delay: 250,
                        dtmf2Digit: '2'
                      };
                      setDtmfSettings(defaults);
                      updateSystemSettings.mutate(defaults);
                    }
                  }}
                  disabled={updateSystemSettings.isPending}
                  className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 disabled:bg-gray-400"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Queue Settings */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Transfer Queue Settings</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">📞 Configure Queue Transfer Numbers</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Set direct phone numbers for your RingCentral queues</li>
            <li>• When a live agent is detected, calls will transfer to this number</li>
            <li>• If not set, the system will attempt to find the number automatically</li>
            <li>• Format: +1234567890 (E.164 format with country code)</li>
          </ul>
        </div>

        {queuesLoading ? (
          <div className="text-gray-500">Loading queues...</div>
        ) : queues && queues.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Queue Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Extension
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Transfer Phone Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {queues.map((queue: QueueConfig) => (
                  <tr key={queue.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {queue.name}
                      {queue.isDefault && (
                        <span className="ml-2 text-xs text-green-600">⭐ Default</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {queue.extensionNumber}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingQueue === queue.id ? (
                        <input
                          type="tel"
                          value={queuePhoneNumber}
                          onChange={(e) => setQueuePhoneNumber(e.target.value)}
                          placeholder="+19492268820"
                          className="w-full px-2 py-1 border rounded font-mono text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className={`font-mono ${queue.phoneNumber ? 'text-gray-900' : 'text-gray-400'}`}>
                          {queue.phoneNumber || 'Not set (auto-detect)'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingQueue === queue.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateQueuePhone.mutate({ queueId: queue.id, phoneNumber: queuePhoneNumber })}
                            disabled={updateQueuePhone.isPending || !queuePhoneNumber}
                            className="text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingQueue(null);
                              setQueuePhoneNumber('');
                            }}
                            className="text-gray-600 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingQueue(queue.id);
                            setQueuePhoneNumber(queue.phoneNumber || '');
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {queue.phoneNumber ? 'Edit' : 'Set Number'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Queues Found
            </h3>
            <p className="text-gray-600">
              Authenticate with RingCentral to sync your call queues
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
