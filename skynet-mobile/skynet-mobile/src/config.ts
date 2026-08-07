import * as storage from './lib/storage';

// This mobile app calls the SAME Next.js API routes the web app already
// uses (/api/allocate, /api/lmd-bags, /api/auth/*).
// Default points to local dev web app (or EXPO_PUBLIC_API_BASE_URL). On-device operators can override
// this from the Settings screen.
const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.97.173:3000';

const STORAGE_KEY = 'skynet_api_base_url';

let cachedBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const stored = await storage.getItemAsync(STORAGE_KEY);
  if (
    stored &&
    stored !== 'https://skynet.dgl.lk' &&
    stored !== 'http://localhost:3000' &&
    !stored.includes('172.26.99.142')
  ) {
    cachedBaseUrl = stored;
  } else {
    cachedBaseUrl = DEFAULT_API_BASE_URL;
  }
  return cachedBaseUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, '');
  cachedBaseUrl = trimmed;
  await storage.setItemAsync(STORAGE_KEY, trimmed);
}


