export interface User {
  readonly id: string
  readonly supabaseId: string
  readonly email: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly role: 'user' | 'admin'
}

export interface ApiResponse<T> {
  readonly data: T
}

export interface ApiErrorResponse {
  readonly error: string
}
