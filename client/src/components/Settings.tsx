import { useState } from 'react';
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
    </div>
  );
}
