// API client. Wraps every request with:
//  - access-token injection,
//  - silent refresh before/after expiry (short ~15min access token),
//  - hard sign-out when the refresh token is revoked/invalid.
//
// The transport underneath is real HTTP against the Spring backend
// (lib/api/http.ts + lib/api/endpoints.ts). There is no local fallback: if the
// backend is unreachable the caller gets a NetworkError, not empty data.
import { tokenStore } from './tokenStore';
import { authRefresh } from './auth';
import { ApiError } from './errors';
import { http } from './http';
import { ROUTES, type Op, type Payload } from './endpoints';
import { isExpiringSoon } from './jwt';
import { connectRealtime } from './realtime';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';

let refreshPromise: Promise<string> | null = null;

/** Single-flight: concurrent 401s share one refresh instead of racing. */
async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const rt = await tokenStore.getRefresh();
      if (!rt) throw new ApiError(401, 'REFRESH_INVALID', 'Session expired.');
      const res = await authRefresh(rt);
      await tokenStore.save(res.accessToken, res.refreshToken);
      useAuthStore.getState().setUser(res.user);
      // The new access token is what the STOMP session must present.
      connectRealtime(res.accessToken);
      return res.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isSessionError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  return (
    e.status === 401 ||
    e.code === 'TOKEN_EXPIRED' ||
    e.code === 'UNAUTHENTICATED' ||
    e.code === 'REFRESH_INVALID'
  );
}

export async function request<T = unknown>(op: Op, payload: Payload = {}): Promise<T> {
  const route = ROUTES[op];
  if (!route) throw new ApiError(400, 'UNKNOWN_OP', 'Invalid request');

  let token = await tokenStore.getAccess();
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');

  if (isExpiringSoon(token)) {
    try {
      token = await refreshAccessToken();
    } catch {
      await useAuthStore.getState().clearSession();
      throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
    }
  }

  const call = (t: string) =>
    http<T>(route.method, route.path(payload), {
      token: t,
      body: route.body ? route.body(payload) : undefined,
    });

  try {
    return await call(token);
  } catch (e) {
    // The token may have died between the pre-flight check and the response.
    if (!isSessionError(e)) throw e;
    try {
      token = await refreshAccessToken();
      return await call(token);
    } catch {
      await useAuthStore.getState().clearSession();
      throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
    }
  }
}

// Mutation error handling — consistent UX for every write action.
export function handleWriteError(e: unknown): void {
  const ui = useUIStore.getState();
  if (e instanceof ApiError && (e.code === 'SUBSCRIPTION_EXPIRED' || e.code === 'SUBSCRIBE_REQUIRED')) {
    // Mid-session expiry -> clear renewal prompt, never stale data as current.
    ui.showRenewPrompt(e.data?.coachId ?? null, e.data?.coachName ?? 'your coach', e.message);
    return;
  }
  if (e instanceof ApiError && e.code === 'REFRESH_INVALID') return; // session already cleared
  ui.showToast(e instanceof Error ? e.message : 'Something went wrong. Please try again.', 'error');
}
