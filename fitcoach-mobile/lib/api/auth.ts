// Auth transport: login / register / refresh / logout against the Spring
// backend. These are the only calls that happen without an access token, so
// they live outside `request()` and never trigger the refresh dance.
//
// No hashing, no demo credentials, no token minting happens here — the backend
// owns all of that (fitcoach-backend/auth + /security). This file only moves
// bytes and stores what comes back in expo-secure-store.
import { http } from './http';
import type { AuthTokens, Role, SessionUser } from './types';

export interface SignUpInput {
  role: Extract<Role, 'client' | 'coach'>;
  name: string;
  email: string;
  password: string;
}

export function authLogin(email: string, password: string): Promise<AuthTokens> {
  return http<AuthTokens>('POST', '/api/auth/login', { body: { email, password } });
}

export function authRegister(input: SignUpInput): Promise<AuthTokens> {
  return http<AuthTokens>('POST', '/api/auth/register', { body: input });
}

export function authRefresh(refreshToken: string): Promise<AuthTokens> {
  return http<AuthTokens>('POST', '/api/auth/refresh', { body: { refreshToken } });
}

/** Best effort: the local session is cleared by the caller either way. */
export async function authLogout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await http('POST', '/api/auth/logout', { body: { refreshToken } });
  } catch {
    // The refresh token is being discarded locally regardless.
  }
}

export function fetchMe(accessToken: string): Promise<SessionUser> {
  return http<SessionUser>('GET', '/api/users/me', { token: accessToken });
}
