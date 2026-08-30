// Zustand — light local session state. Tokens themselves live in
// expo-secure-store; this store only holds what the UI needs to render.
//
// All credential handling happens in fitcoach-backend (BCrypt, lockout, JWT
// issuance). Nothing here hashes a password or knows a demo login.
import { create } from 'zustand';
import type { SessionUser } from '../lib/api/types';
import { authLogin, authLogout, authRefresh, authRegister, fetchMe, type SignUpInput } from '../lib/api/auth';
import { tokenStore } from '../lib/api/tokenStore';
import { connectRealtime, disconnectRealtime } from '../lib/api/realtime';

interface AuthState {
  user: SessionUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (u: SessionUser) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  // Boot: restore the session from secure storage. Prefer a silent refresh
  // (the ~15 min access token is usually stale); fall back to the access token
  // as-is so an offline boot can still render until the first request fails.
  hydrate: async () => {
    try {
      const at = await tokenStore.getAccess();
      const rt = await tokenStore.getRefresh();
      if (!at || !rt) {
        set({ hydrated: true });
        return;
      }
      let access = at;
      try {
        const res = await authRefresh(rt);
        access = res.accessToken;
        await tokenStore.save(res.accessToken, res.refreshToken);
        connectRealtime(access);
        set({ user: res.user, hydrated: true });
        return;
      } catch {
        // Refresh failed (offline, or rotated) — try the stored access token.
      }
      const me = await fetchMe(access);
      connectRealtime(access);
      set({ user: me, hydrated: true });
    } catch {
      // Session is unusable: drop the tokens rather than keep a zombie login.
      await tokenStore.clear();
      await disconnectRealtime();
      set({ user: null, hydrated: true });
    }
  },

  setUser: (u) => set({ user: u }),

  signIn: async (email, password) => {
    const res = await authLogin(email, password);
    await tokenStore.save(res.accessToken, res.refreshToken);
    connectRealtime(res.accessToken);
    set({ user: res.user });
  },

  signUp: async (input) => {
    const res = await authRegister(input);
    await tokenStore.save(res.accessToken, res.refreshToken);
    connectRealtime(res.accessToken);
    set({ user: res.user });
  },

  signOut: async () => {
    const rt = await tokenStore.getRefresh();
    await authLogout(rt);
    await tokenStore.clear();
    await disconnectRealtime();
    set({ user: null });
  },

  clearSession: async () => {
    await tokenStore.clear();
    await disconnectRealtime();
    set({ user: null });
  },
}));
