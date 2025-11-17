import axios from 'axios';

// Helper to normalize URL (remove trailing slashes)
const normalizeUrl = (url: string): string => {
  return url.replace(/\/+$/, ''); // Remove trailing slashes
};

const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Remove trailing slashes and add /api
    return `${normalizeUrl(apiUrl)}/api`;
  }
  return '/api'; // Relative path for same-origin requests
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true
});

// Add response interceptor to handle 401 errors silently
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 errors are expected when not logged in - don't log them as errors
    if (error.response?.status === 401) {
      // Silently handle 401 - the AuthContext will handle redirecting to login
      return Promise.reject(error);
    }
    // Log other errors
    // eslint-disable-next-line no-console
    console.error('API Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Hook for convenience; now identical to apiClient but kept for clarity.
export const useAuthedApi = () => apiClient;
