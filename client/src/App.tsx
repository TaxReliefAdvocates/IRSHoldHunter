import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { JobStarter } from './components/JobStarter';
import { ActiveJob } from './components/ActiveJob';
import { ExtensionManager } from './components/ExtensionManager';
import { QueueManagement } from './components/QueueManagement';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { useSocket } from './hooks/useSocket';
import { apiClient } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'jobs' | 'extensions' | 'queues' | 'settings'>('jobs');
  const { isConnected } = useSocket();

  // Check authentication status
  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => apiClient('/oauth/status').then(r => r.json()),
    refetchInterval: 60000, // Check every minute
  });

  const handleJobStarted = (jobId: string) => {
    setCurrentJobId(jobId);
  };

  const handleNewJob = () => {
    setCurrentJobId(null);
  };

  const handleLogout = async () => {
    try {
      await apiClient('/oauth/logout', { method: 'POST' });
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!authStatus?.authenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-gray-900">IRS Hold Hunter</h1>
              <nav className="flex gap-4">
                <button
                  onClick={() => {
                    setCurrentView('jobs');
                    setCurrentJobId(null);
                  }}
                  className={`px-3 py-1 rounded ${
                    currentView === 'jobs'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Jobs
                </button>
                <button
                  onClick={() => setCurrentView('extensions')}
                  className={`px-3 py-1 rounded ${
                    currentView === 'extensions'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Extensions
                </button>
                <button
                  onClick={() => setCurrentView('queues')}
                  className={`px-3 py-1 rounded ${
                    currentView === 'queues'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Queues
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`px-3 py-1 rounded ${
                    currentView === 'settings'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Settings
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {authStatus?.user && (
                <div className="flex items-center gap-3 border-l border-gray-300 pl-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {authStatus.user.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ext {authStatus.user.extensionNumber}
                      {authStatus.user.isAdmin && (
                        <span className="ml-2 text-green-600 font-semibold">⭐ SuperAdmin</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'settings' ? (
          <Settings />
        ) : currentView === 'queues' ? (
          <QueueManagement />
        ) : currentView === 'extensions' ? (
          <ExtensionManager />
        ) : currentJobId ? (
          <ActiveJob jobId={currentJobId} onNewJob={handleNewJob} />
        ) : (
          <JobStarter onJobStarted={handleJobStarted} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            IRS Hold Hunter - Production MVP
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
