/** The three calls the server offers. Everything sent here is already encrypted or public. */

export interface CreateRequest {
  id: string
  ciphertext: string
  writePublicKey: string
}

export interface UpdateRequest {
  ciphertext: string
  version: number
  signature: string
}

export interface BlobResponse {
  id: string
  ciphertext: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface BlobApi {
  create(request: CreateRequest): Promise<{ id: string; version: number }>
  get(id: string): Promise<BlobResponse>
  update(id: string, request: UpdateRequest): Promise<{ id: string; version: number }>
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server.')
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    data = undefined
  }
  if (!response.ok) {
    const message = (data as { error?: unknown } | undefined)?.error
    throw new ApiError(response.status, typeof message === 'string' ? message : `Server error (${response.status}).`)
  }
  return data as T
}

export const httpApi: BlobApi = {
  create: (body) => request('POST', '/blob', body),
  get: (id) => request('GET', `/blob/${id}`),
  update: (id, body) => request('PUT', `/blob/${id}`, body),
}
