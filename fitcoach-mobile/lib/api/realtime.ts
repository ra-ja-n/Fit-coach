// Realtime client — a real STOMP connection to the Spring broker
// (config/WebSocketConfig), replacing the previous in-process event bus.
//
// Call sites are unchanged: screens still `subscribeRealtime(listener)` and get
// `{type, coachId, clientId}` events, which RootNavigator turns into TanStack
// Query invalidations. What changed is where the events come from — the server
// pushes them over `/user/queue/events` after an ownership check, instead of a
// local emitter firing because the same process wrote the data.
//
// `emitRealtime` is kept for local, optimistic invalidation only. It never
// stands in for a server push.
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { WS_QUEUE_EVENTS, WS_URL } from './config';

export type RealtimeEvent =
  | { type: 'chat'; coachId: string; clientId: string }
  | { type: 'progress'; coachId: string; clientId: string }
  | { type: 'plan'; coachId: string; clientId: string }
  | { type: 'subscription'; coachId?: string; clientId?: string };

type Listener = (e: RealtimeEvent) => void;

const listeners = new Set<Listener>();

let client: Client | null = null;
let subscription: StompSubscription | null = null;
let currentToken: string | null = null;

function dispatch(e: RealtimeEvent): void {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch {
      // One broken listener must not stop the others (or the socket).
    }
  });
}

function parseEvent(body: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(body) as Partial<RealtimeEvent> & { type?: string };
    if (
      parsed.type === 'chat' ||
      parsed.type === 'progress' ||
      parsed.type === 'plan' ||
      parsed.type === 'subscription'
    ) {
      return parsed as RealtimeEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Opens (or re-opens, with a fresh token) the STOMP session. Safe to call
 * repeatedly: an already-connected session with the same token is left alone.
 */
export function connectRealtime(accessToken: string): void {
  if (typeof WebSocket === 'undefined') return; // no WebSocket in this runtime
  if (client?.active && currentToken === accessToken) return;

  void disconnectRealtime().then(() => {
    currentToken = accessToken;
    const stomp = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      // React Native cannot set HTTP headers on the upgrade request, so the
      // token rides on the STOMP CONNECT frame (StompAuthChannelInterceptor).
      webSocketFactory: () => new WebSocket(WS_URL),
      reconnectDelay: 5_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
    });

    stomp.onConnect = () => {
      subscription = stomp.subscribe(WS_QUEUE_EVENTS, (message: IMessage) => {
        const event = parseEvent(message.body);
        if (event) dispatch(event);
      });
    };
    stomp.onStompError = () => {
      // Nothing actionable client-side; reconnectDelay retries, and REST
      // queries remain the source of truth for what is on screen.
      subscription = null;
    };
    stomp.onWebSocketClose = () => {
      subscription = null;
    };

    client = stomp;
    try {
      // activate() resolves once the socket is up and retries on its own via
      // reconnectDelay; a failure here is not fatal, REST still works.
      stomp.activate();
    } catch {
      client = null;
    }
  });
}

export async function disconnectRealtime(): Promise<void> {
  const existing = client;
  client = null;
  subscription = null;
  currentToken = null;
  if (!existing) return;
  try {
    await existing.deactivate();
  } catch {
    // Already closed.
  }
}

export function isRealtimeConnected(): boolean {
  return client?.connected === true;
}

/**
 * Register for server-pushed events. Returns an unsubscribe function.
 * Kept identical to the previous in-memory bus so screens did not change.
 */
export function subscribeRealtime(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Local-only dispatch, for optimistic UI (e.g. invalidate now, confirm later).
 * The server is the source of truth; this never fakes a server push.
 */
export function emitRealtime(e: RealtimeEvent): void {
  dispatch(e);
}
