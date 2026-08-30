// Where the backend lives. Read once at startup from EXPO_PUBLIC_* env vars
// (inlined by Metro at build time) with a localhost fallback for local dev.
//
//   cp .env.example .env   # then edit to point at your backend
//
// There is deliberately no in-app fallback backend: if these are wrong the app
// surfaces a network error rather than quietly serving stale local data.

function readEnv(name: string): string | undefined {
  // EXPO_PUBLIC_* vars are statically replaced by Metro. The cast keeps this
  // file usable in plain Node (tests) where process.env has no such keys.
  const value = (process.env as Record<string, string | undefined>)[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

export const API_URL: string = (readEnv('EXPO_PUBLIC_API_URL') ?? 'http://localhost:8080').replace(/\/+$/, '');

export const WS_URL: string = readEnv('EXPO_PUBLIC_WS_URL') ?? `${API_URL.replace(/^http/, 'ws')}/ws`;

/** STOMP destinations — must match config/WebSocketConfig + RealtimePublisher. */
export const WS_QUEUE_EVENTS = '/user/queue/events';
export const WS_APP_PREFIX = '/app';

export function wsChatQueue(coachId: string, clientId: string): string {
  return `/user/queue/chat.${coachId}.${clientId}`;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
