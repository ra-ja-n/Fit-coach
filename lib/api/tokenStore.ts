// Token persistence — expo-secure-store ONLY (never AsyncStorage on device).
import { secureDelete, secureGet, secureSet } from '../secure';

const ACCESS_KEY = 'fitcoach.access';
const REFRESH_KEY = 'fitcoach.refresh';

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return secureGet(ACCESS_KEY);
  },
  async getRefresh(): Promise<string | null> {
    return secureGet(REFRESH_KEY);
  },
  async save(accessToken: string, refreshToken: string): Promise<void> {
    await secureSet(ACCESS_KEY, accessToken);
    await secureSet(REFRESH_KEY, refreshToken);
  },
  async clear(): Promise<void> {
    await secureDelete(ACCESS_KEY);
    await secureDelete(REFRESH_KEY);
  },
};
