/**
 * Represents the authenticated user context extracted from the JWT token.
 * This is the validated payload returned by JwtStrategy.validate()
 * and injected into controllers via the @User() decorator.
 */
export interface UserContext {
  /** User ID from the backend system */
  sub: string;

  /** Display name / username */
  username: string;

  /** Role-based access control roles */
  roles: string[];
}
