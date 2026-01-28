import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Extension {
  id: string;
  extensionNumber: string;
  name: string;
  department?: string;
  type?: string;
  status?: string;
  enabledForHunting: boolean;
  tags: string[];
  currentJobId?: string;
  lastUsed?: string;
  phoneNumbers?: string[];
  hasDirectNumber?: boolean;
}

export function ExtensionManager() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    enabled: false,
    available: false,
    hasPhone: false,
    type: '',
    status: ''
  });
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [newPoolName, setNewPoolName] = useState('');

  const { data: extensions, isLoading } = useQuery({
    queryKey: ['extensions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.enabled) params.set('enabled', 'true');
      if (filters.available) params.set('available', 'true');
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      
      const res = await fetch(`/api/extensions?${params}`);
      return res.json();
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['extension-stats'],
    queryFn: () => fetch('/api/extensions/stats').then(r => r.json())
  });

  const syncExtensions = useMutation({
    mutationFn: () => fetch('/api/extensions/sync', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      queryClient.invalidateQueries({ queryKey: ['extension-stats'] });
    }
  });

  const cleanupStuck = useMutation({
    mutationFn: () => fetch('/api/extensions/cleanup', { method: 'POST' }).then(r => r.json()),
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      queryClient.invalidateQueries({ queryKey: ['extension-stats'] });
    }
  });

  const syncStatus = useMutation({
    mutationFn: () => fetch('/api/extensions/sync-status', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      queryClient.invalidateQueries({ queryKey: ['extension-stats'] });
    }
  });

  const toggleExtension = useMutation({
    mutationFn: (ext: Extension) =>
      fetch(`/api/extensions/${ext.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledForHunting: !ext.enabledForHunting })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    }
  });

  const bulkEnable = useMutation({
    mutationFn: (enabled: boolean) =>
      fetch('/api/extensions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionIds: selectedExtensions,
          updates: { enabledForHunting: enabled }
        })
      }),
    onSuccess: () => {
      setSelectedExtensions([]);
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    }
  });

  const savePool = useMutation({
    mutationFn: () =>
      fetch('/api/extensions/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPoolName,
          extensionIds: selectedExtensions
        })
      }),
    onSuccess: () => {
      setNewPoolName('');
      setSelectedExtensions([]);
      alert(`Pool "${newPoolName}" saved with ${selectedExtensions.length} extensions`);
    }
  });

  const handleSelectAll = (displayedExtensions: Extension[]) => {
    if (selectedExtensions.length === displayedExtensions?.length) {
      setSelectedExtensions([]);
    } else {
      setSelectedExtensions(displayedExtensions?.map((e: Extension) => e.id) || []);
    }
  };

  const enableAllForHunting = useMutation({
    mutationFn: (extensionIds: string[]) =>
      fetch('/api/extensions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionIds,
          updates: { enabledForHunting: true }
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    }
  });

  const disableAllForHunting = useMutation({
    mutationFn: (extensionIds: string[]) =>
      fetch('/api/extensions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionIds,
          updates: { enabledForHunting: false }
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    }
  });

  if (isLoading) return <div className="p-4">Loading extensions...</div>;

  // Apply client-side filters
  const filteredExtensions = extensions?.filter((ext: Extension) => {
    if (filters.hasPhone && !ext.hasDirectNumber) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Extension Management</h1>
          <div className="flex gap-2">
            <button
              onClick={() => syncStatus.mutate()}
              disabled={syncStatus.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {syncStatus.isPending ? 'Syncing...' : '🔄 Sync Real-Time Status'}
            </button>
            <button
              onClick={() => cleanupStuck.mutate()}
              disabled={cleanupStuck.isPending}
              className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-gray-400"
            >
              {cleanupStuck.isPending ? 'Cleaning...' : '🧹 Cleanup Stuck'}
            </button>
            <button
              onClick={() => syncExtensions.mutate()}
              disabled={syncExtensions.isPending}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {syncExtensions.isPending ? 'Syncing...' : '📞 Sync from RC'}
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Extensions</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
              <div className="text-sm text-gray-600">Enabled for Hunting</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{stats.available}</div>
              <div className="text-sm text-gray-600">Available Now</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600">{stats.inUse}</div>
              <div className="text-sm text-gray-600">Currently In Use</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-purple-600">
                {extensions?.filter((e: Extension) => e.hasDirectNumber).length || 0}
              </div>
              <div className="text-sm text-gray-600">📞 With Phone Numbers</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <input
              type="text"
              placeholder="Search extensions..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <select
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              className="px-3 py-2 border rounded"
            >
              <option value="">All Types</option>
              <option value="User">User</option>
              <option value="Department">Department</option>
              <option value="IvrMenu">IVR Menu</option>
            </select>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.enabled}
                onChange={e => setFilters({ ...filters, enabled: e.target.checked })}
              />
              Enabled Only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.available}
                onChange={e => setFilters({ ...filters, available: e.target.checked })}
              />
              Available Only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.hasPhone}
                onChange={e => setFilters({ ...filters, hasPhone: e.target.checked })}
              />
              📞 Has Phone Only
            </label>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedExtensions.length > 0 && (
          <div className="bg-yellow-50 p-4 rounded-lg shadow mb-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {selectedExtensions.length} extension(s) selected
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => bulkEnable.mutate(true)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                >
                  Enable for Hunting
                </button>
                <button
                  onClick={() => bulkEnable.mutate(false)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Disable for Hunting
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pool name..."
                    value={newPoolName}
                    onChange={e => setNewPoolName(e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <button
                    onClick={() => savePool.mutate()}
                    disabled={!newPoolName || savePool.isPending}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:bg-gray-400"
                  >
                    Save as Pool
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extension Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedExtensions.length === filteredExtensions?.length && filteredExtensions?.length > 0}
                  onChange={() => handleSelectAll(filteredExtensions || [])}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Ext #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Phone Numbers
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-gray-500 uppercase">Hunting</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => enableAllForHunting.mutate(filteredExtensions?.map((e: Extension) => e.id) || [])}
                      disabled={enableAllForHunting.isPending}
                      className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 disabled:bg-gray-400"
                      title="Enable all displayed extensions for hunting"
                    >
                      ✓ All
                    </button>
                    <button
                      onClick={() => disableAllForHunting.mutate(filteredExtensions?.map((e: Extension) => e.id) || [])}
                      disabled={disableAllForHunting.isPending}
                      className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 disabled:bg-gray-400"
                      title="Disable all displayed extensions for hunting"
                    >
                      ✗ All
                    </button>
                  </div>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Current Job
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredExtensions?.map((ext: Extension) => (
              <tr 
                key={ext.id} 
                className={
                  ext.currentJobId 
                    ? 'bg-red-50' 
                    : ext.hasDirectNumber 
                    ? 'bg-green-50' 
                    : ''
                }
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedExtensions.includes(ext.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedExtensions([...selectedExtensions, ext.id]);
                      } else {
                        setSelectedExtensions(selectedExtensions.filter(id => id !== ext.id));
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-mono">{ext.extensionNumber}</td>
                <td className="px-4 py-3 text-sm">{ext.name}</td>
                <td className="px-4 py-3 text-sm">{ext.type}</td>
                <td className="px-4 py-3 text-sm">
                  {ext.phoneNumbers && ext.phoneNumbers.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {ext.phoneNumbers.map((num, i) => (
                        <div key={i} className="font-mono text-xs bg-green-100 px-2 py-1 rounded">
                          📞 {num}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">No phone number</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {ext.currentJobId ? (
                    <span className="text-red-600">🔴 In Use</span>
                  ) : (
                    <span className="text-green-600">🟢 Available</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={ext.enabledForHunting ?? false}
                    onChange={() => toggleExtension.mutate(ext)}
                    disabled={!!ext.currentJobId}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {ext.currentJobId || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
