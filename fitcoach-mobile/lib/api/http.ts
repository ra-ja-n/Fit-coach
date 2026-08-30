// HTTP transport. The only place in the app that touches `fetch`.
//
// Two failure modes are kept deliberately distinct:
//   - ApiError      — the server answered. status/code/data come from the
//                     ApiResponse envelope in fitcoach-backend/common.
//   - NetworkError  — the server did not answer at all. Nothing was fetched,
//                     and the app must say so instead of showing empty state.
import { apiUrl } from './config';
import { ApiError } from './errors';

export class NetworkError extends ApiError {
  constructor(message = 'Cannot reach the FitCoach server. Check your connection.') {
    super(0, 'NETWORK_ERROR', message);
    this.name = 'NetworkError';
  }
}

export interface RawResponse {
  status: number;
  body: unknown;
}

/** Error payload shape sent by GlobalExceptionHandler / ApiResponse. */
interface ErrorEnvelope {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: Record<string, unknown>;
  fields?: Record<string, string>;
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const code = envelope.code ?? `HTTP_${status}`;
  const fields = envelope.fields;
  const message =
    fields && Object.keys(fields).length > 0
      ? Object.values(fields)[0] ?? 'Please check the highlighted fields.'
      : envelope.message ?? defaultMessage(status);
  return new ApiError(status, code, message, envelope.data);
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You do not have access to this.';
  if (status === 404) return 'Resource not found';
  if (status === 423) return 'Too many failed attempts. Try again later.';
  if (status >= 500) return 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}

export async function http<T>(
  method: string,
  path: string,
  options: { token?: string | null; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    // fetch rejects on DNS failure, refused connection, offline, CORS. None of
    // these mean "no data" — they mean the request never completed.
    throw new NetworkError();
  }

  const text = await res.text();
  const body: unknown = text.length === 0 ? null : safeParse(text);

  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
