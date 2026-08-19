export type AuthPublicErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'CSRF_REJECTED'
  | 'GOOGLE_IDENTITY_INVALID'
  | 'GOOGLE_IDENTITY_MISMATCH'
  | 'LOGIN_ATTEMPT_INVALID'
  | 'LOGIN_RESPONSE_INVALID'
  | 'USER_INACTIVE'
  | 'USER_NOT_AUTHORIZED';

export class AuthPublicError extends Error {
  public constructor(
    public readonly code: AuthPublicErrorCode,
    public readonly statusCode: number,
  ) {
    super(code);
    this.name = new.target.name;
  }
}
