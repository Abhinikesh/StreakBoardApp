import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Module-level token cache — updated via setAuthToken()
let currentToken = null;

// Initialise token from secure store on first import
(async () => {
  try {
    const stored = await SecureStore.getItemAsync('token');
    if (stored) currentToken = stored;
  } catch (_) {}
})();

const api = axios.create({
  baseURL: 'https://streakboard.onrender.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — injects Bearer token if available
api.interceptors.request.use(
  (config) => {
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Call this after login / logout to keep currentToken in sync.
 * Pass null to clear the token.
 */
export const setAuthToken = (token) => {
  currentToken = token;
};

export default api;
