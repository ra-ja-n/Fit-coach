// API error contract. Cross-tenant access intentionally looks identical to
// "not found" (404 NOT_FOUND) so guessed IDs reveal nothing.

export class ApiError extends Error {
  status: number;
  code: string;
  data?: any;
  constructor(status: number, code: string, message: string, data?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
