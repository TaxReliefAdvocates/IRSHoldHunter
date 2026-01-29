// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://irs-hold-hunter-api.onrender.com' : '');

// Helper to make API calls with absolute URLs in production
export async function apiClient(endpoint: string, options?: RequestInit) {
  // In production, use absolute API URL. In dev, use relative (proxied)
  const url = import.meta.env.PROD 
    ? `${API_BASE_URL}${endpoint}` 
    : endpoint;
  
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}
