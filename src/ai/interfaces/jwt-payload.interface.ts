/**
 * Represents the raw JWT token payload before validation.
 * This is the shape of the decoded token passed to JwtStrategy.validate().
 */
export interface JwtPayload {
  /** Subject — user ID */
  sub: string;

  /** Username claim */
  username: string;

  /** User roles (may be absent in some tokens) */
  roles?: string[];

  /** Issued-at timestamp (set by JWT library) */
  iat?: number;

  /** Expiration timestamp (set by JWT library) */
  exp?: number;
}
