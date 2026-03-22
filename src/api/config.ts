/**
 * Mentor G - API Configuration
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

const API_KEY_STORAGE_KEY = 'mentor-g-api-key';

// Set this to your Cloudflare Worker URL for production
// Leave empty to use direct API with user's key
export const WORKER_URL = 'https://mentor-g-api.mentor-g-api.workers.dev';
// Example: export const WORKER_URL = 'https://mentor-g-api.your-subdomain.workers.dev';

export function useWorkerMode(): boolean {
  return WORKER_URL.length > 0;
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function hasApiKey(): boolean {
  // In worker mode, we don't need a user API key
  if (useWorkerMode()) return true;

  const key = getApiKey();
  return key !== null && key.length > 0;
}
