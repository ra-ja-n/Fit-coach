// Minimal JWT reader. The app never verifies a token — only the backend can do
// that — it just needs `exp` so it can refresh *before* a request fails rather
// than after. Verification failures still come back as a 401 from the server.
//
// Hand-rolled base64url + UTF-8 because React Native has no guaranteed `atob`.

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlDecode(input: string): Uint8Array {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = B64_ALPHABET.indexOf(char);
    if (value < 0) continue; // ignore anything outside the alphabet
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i++]!;
    let code: number;
    if (byte < 0x80) {
      code = byte;
    } else if (byte >= 0xc0 && byte < 0xe0) {
      code = ((byte & 0x1f) << 6) | (bytes[i++]! & 0x3f);
    } else if (byte >= 0xe0 && byte < 0xf0) {
      code = ((byte & 0x0f) << 12) | ((bytes[i++]! & 0x3f) << 6) | (bytes[i++]! & 0x3f);
    } else {
      code =
        ((byte & 0x07) << 18) |
        ((bytes[i++]! & 0x3f) << 12) |
        ((bytes[i++]! & 0x3f) << 6) |
        (bytes[i++]! & 0x3f);
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
      continue;
    }
    out += String.fromCharCode(code);
  }
  return out;
}

export interface JwtClaims {
  sub?: string;
  role?: string;
  typ?: string;
  /** Seconds since epoch. */
  exp?: number;
}

/** @returns the claims, or null when the token isn't a parseable JWT. */
export function readJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(utf8Decode(base64UrlDecode(parts[1]!))) as JwtClaims;
  } catch {
    return null;
  }
}

/** Milliseconds since epoch at which the token expires; 0 when unreadable. */
export function tokenExpiresAt(token: string): number {
  const exp = readJwt(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : 0;
}

/** Treat a token as expired 30s early so clock skew can't cost us a request. */
export function isExpiringSoon(token: string, skewMs = 30_000): boolean {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === 0) return true; // unreadable -> refresh it
  return expiresAt - Date.now() < skewMs;
}
