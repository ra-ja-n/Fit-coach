// Realtime event bus. In production this is the Spring WebSocket (STOMP)
// channel; the mobile client subscribes and invalidates TanStack Query cache
// entries so coach <-> client data changes appear instantly on both sides.

export type RealtimeEvent =
  | { type: 'chat'; coachId: string; clientId: string }
  | { type: 'progress'; coachId: string; clientId: string }
  | { type: 'plan'; coachId: string; clientId: string }
  | { type: 'subscription'; coachId?: string; clientId?: string };

type Listener = (e: RealtimeEvent) => void;

const listeners = new Set<Listener>();

export function subscribeRealtime(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function emitRealtime(e: RealtimeEvent) {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch {
      // listener errors must never break the emitter (the "server")
    }
  });
}
