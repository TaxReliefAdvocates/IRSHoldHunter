import { useQuery } from '@tanstack/react-query';
import { apiClient, API_BASE_URL } from '../lib/api';
import { useEffect } from 'react';

export function Login() {
  const { data: authStatus, refetch } = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => apiClient('/oauth/status').then(r => r.json()),
    refetchInterval: 5000, // Check every 5 seconds
  });

  // Check for auth success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    
    if (authResult === 'success') {
      // Remove query param
      window.history.replaceState({}, '', window.location.pathname);
      // Refetch auth status
      refetch();
    } else if (authResult === 'error') {
      alert('Authentication failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refetch]);

  const handleLogin = () => {
    // Redirect to OAuth authorize endpoint on backend API
    window.location.href = `${API_BASE_URL}/oauth/authorize`;
  };

  if (authStatus?.authenticated) {
    return null; // User is logged in, don't show login screen
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            IRS Hold Hunter
          </h1>
          <p className="text-gray-600">
            Multi-line calling system for RingCentral
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            🔐 Authentication Required
          </h3>
          <p className="text-sm text-blue-800">
            Please login with your RingCentral account to continue.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-900 mb-2">
            ⚠️ Important: SuperAdmin Required
          </h3>
          <p className="text-sm text-yellow-800 mb-2">
            For multi-extension calling, you must login with a <strong>SuperAdmin</strong> account.
          </p>
          <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
            <li>Regular users can only call from their own extension</li>
            <li>SuperAdmin can call from all 68 extensions</li>
            <li>Check with your IT admin if you need SuperAdmin access</li>
          </ul>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
        >
          Login with RingCentral
        </button>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This will redirect you to RingCentral's secure login page.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            You'll be redirected back after authentication.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-2 text-sm">
            What happens after login:
          </h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>✅ Tokens stored securely</li>
            <li>✅ Auto-refresh enabled (never expires)</li>
            <li>✅ Multi-extension calling (if SuperAdmin)</li>
            <li>✅ Ready to start hunting IRS hold queues!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
