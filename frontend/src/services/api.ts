import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Hook for convenience; now identical to apiClient but kept for clarity.
export const useAuthedApi = () => apiClient;
