import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  withCredentials: true
});

// Hook for convenience; now identical to apiClient but kept for clarity.
export const useAuthedApi = () => apiClient;
