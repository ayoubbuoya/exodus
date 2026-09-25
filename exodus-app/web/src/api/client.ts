// A tiny client for our backend (exodus-app/api).
//
// The browser calls /api/... on the web app's own origin and Vite forwards it
// to the API (see vite.config.ts). So the session cookie is sent automatically
// and there is no CORS to set up.
//
// The API wraps every answer the same way:
//   success: { "statusCode": 200, "message": "Logged in", "data": { ... } }
//   error:   { "statusCode": 400, "message": "Validation failed", "errors": [{ "field": "email", "message": "..." }] }
// apiRequest returns `data`, or throws an ApiError.

// An error answer from the API, ready to show in the UI.
// Example: status 409, message "An account with this email already exists."
// fieldErrors maps a form field to its message, for example { password: "The password needs at least 10 characters." }
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

type ApiErrorBody = {
  message?: string
  errors?: { field: string; message: string }[]
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function apiRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })

  // 204 No Content (for example logout): nothing to read.
  if (response.status === 204) {
    return undefined as T
  }

  const json = await readJson(response)
  if (!response.ok) {
    throw toApiError(json, response.status)
  }
  return (json as { data: T }).data
}

// When the API is not running, the Vite proxy answers with an empty or plain-text
// 500/502. We turn that into a clear message instead of a JSON parse error.
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('The Exodus server is not reachable. Is `npm run api` running?', response.status)
  }
}

function toApiError(json: unknown, status: number): ApiError {
  const body = json as ApiErrorBody
  const fieldErrors: Record<string, string> = {}
  for (const error of body.errors ?? []) {
    fieldErrors[error.field] = error.message
  }
  return new ApiError(body.message ?? `Request failed (HTTP ${status})`, status, fieldErrors)
}

// True for "not logged in / session expired".
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

// The message for one form field from a validation error, or undefined.
// Example: fieldErrorOf(error, "password") -> "The password needs at least 10 characters."
export function fieldErrorOf(error: unknown, field: string): string | undefined {
  if (error instanceof ApiError) {
    return error.fieldErrors[field]
  }
  return undefined
}
