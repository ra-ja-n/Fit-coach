// API client. Wraps every request with:
//  - access-token injection,
//  - silent refresh before/after expiry (short ~15min access token),
//  - hard sign-out when the refresh token is revoked/invalid.
import { tokenStore } from './tokenStore';
import { authRefresh, handle, parseToken, type Op } from './server';
import { ApiError } from './errors';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';

async function isExpired(token: string): Promise<boolean> {
  try {
    const p = parseToken(token);
    return p.exp - Date.now() < 30_000; // 30s skew
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const rt = await tokenStore.getRefresh();
      if (!rt) throw new ApiError(401, 'REFRESH_INVALID', 'Session expired.');
      const res = await authRefresh(rt);
      await tokenStore.save(res.accessToken, res.refreshToken);
      useAuthStore.getState().setUser(res.user);
      return res.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function request<T = any>(op: Op, payload?: any): Promise<T> {
  let token = await tokenStore.getAccess();
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');
  if (await isExpired(token)) {
    try {
      token = await refreshAccessToken();
    } catch {
      await useAuthStore.getState().clearSession();
      throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
    }
  }
  try {
    return await handle(token, op, payload);
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'TOKEN_EXPIRED' || e.code === 'UNAUTHENTICATED')) {
      try {
        token = await refreshAccessToken();
        return await handle(token, op, payload);
      } catch {
        await useAuthStore.getState().clearSession();
        throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
      }
    }
    throw e;
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
