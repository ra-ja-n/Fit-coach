// Zustand — light local session state. Tokens themselves live in
// expo-secure-store; this store only holds what the UI needs to render.
import { create } from 'zustand';
import type { SessionUser } from '../lib/api/types';
import { authLogin, authLogout, authRefresh, authRegister, handle } from '../lib/api/server';
import { tokenStore } from '../lib/api/tokenStore';
import { ApiError } from '../lib/api/errors';

interface AuthState {
  user: SessionUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (u: SessionUser) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { role: 'client' | 'coach'; name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,

  // Boot: restore session from secure storage, silently refreshing if the
  // short-lived access token has expired.
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
        set({ user: res.user, hydrated: true });
        return;
      } catch {
        // fall through to try the access token as-is
      }
      const me = await handle(access, 'me.get');
      set({ user: me as SessionUser, hydrated: true });
    } catch {
      await tokenStore.clear();
      set({ user: null, hydrated: true });
    }
  },

  setUser: (u) => set({ user: u }),

  signIn: async (email, password) => {
    const res = await authLogin(email, password);
    await tokenStore.save(res.accessToken, res.refreshToken);
    set({ user: res.user });
  },

  signUp: async (input) => {
    const res = await authRegister(input);
    await tokenStore.save(res.accessToken, res.refreshToken);
    set({ user: res.user });
  },

  signOut: async () => {
    const rt = await tokenStore.getRefresh();
    await authLogout(rt);
    await tokenStore.clear();
    set({ user: null });
  },

  clearSession: async () => {
    await tokenStore.clear();
    set({ user: null });
  },
}));
