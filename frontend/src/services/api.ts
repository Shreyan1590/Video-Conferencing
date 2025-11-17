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

// Hook for convenience; now identical to apiClient but kept for clarity.
export const useAuthedApi = () => apiClient;
