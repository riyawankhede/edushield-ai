/**
 * Server-side authentication utilities for Next.js App Router.
 *
 * Provides functions to read and verify JWT access tokens from cookies,
 * returning authenticated user context for protected API routes.
 *
 * Security:
 * - Always verifies JWT signature
 * - Enforces algorithm restrictions (HS256)
 * - Generic error messages (no internal JWT error exposure)
 * - No database lookup (JWT-only verification)
 * - Cookie-only token storage (no query params, body, localStorage)
 */

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyAccessToken, type DecodedAccessToken } from "@/lib/jwt";
import { APIError } from "@/lib/api-error";
import type { UserRole } from "@/types/identity";

/**
 * Authenticated user context.
 * Extracted from verified JWT access token.
 */
export interface AuthContext {
  userId: string;
  role: string;
  schoolId: string;
}

/**
 * Get authenticated user context from the current request.
 *
 * Reads the access_token HttpOnly cookie, verifies the JWT signature,
 * and returns the authenticated user identity.
 *
 * @throws {APIError} UNAUTHORIZED if authentication fails
 * @returns Authenticated user context with userId, role, schoolId
 *
 * Usage in API routes:
 * ```typescript
 * export async function GET() {
 *   const auth = await getAuthContext();
 *   // auth.userId, auth.role, auth.schoolId are now available
 * }
 * ```
 */
export async function getAuthContext(): Promise<AuthContext> {
  try {
    // Read access_token from HttpOnly cookie
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      throw APIError.unauthorized("Authentication required");
    }

    // Verify JWT signature and decode payload
    // verifyAccessToken() enforces:
    // - HS256 algorithm
    // - Valid signature
    // - Not expired
    // - Required claims present
    let decoded: DecodedAccessToken;
    try {
      decoded = await verifyAccessToken(token);
    } catch {
      // Do not expose internal JWT errors to clients
      // Generic authentication error for all JWT failures
      throw APIError.unauthorized("Authentication required");
    }

    // Extract authentication context from verified JWT
    const auth: AuthContext = {
      userId: decoded.userId,
      role: decoded.role,
      schoolId: decoded.schoolId,
    };

    return auth;
  } catch (error) {
    // Re-throw APIError as-is
    if (error instanceof APIError) {
      throw error;
    }
    // Catch-all for unexpected errors
    throw APIError.unauthorized("Authentication required");
  }
}

/**
 * Optional authentication context getter.
 *
 * Returns authenticated context if valid token present, otherwise null.
 * Does not throw on missing/invalid authentication.
 *
 * Useful for routes that are optionally authenticated (e.g., public data
 * with additional features for authenticated users).
 *
 * @returns AuthContext if authenticated, null otherwise
 */
export async function getOptionalAuthContext(): Promise<AuthContext | null> {
  try {
    return await getAuthContext();
  } catch {
    return null;
  }
}

/**
 * Require authentication and optionally verify role.
 *
 * First authenticates the user via getAuthContext(), then optionally
 * checks if the authenticated user's role matches one of the allowed roles.
 *
 * @param request - Next.js request object (for consistency with route handler signatures)
 * @param allowedRoles - Optional roles; if provided, user must have one of these roles
 * @returns Authenticated user context with userId, role, schoolId
 * @throws {APIError} UNAUTHORIZED (401) if not authenticated
 * @throws {APIError} FORBIDDEN (403) if authenticated but role not allowed
 *
 * Usage examples:
 * ```typescript
 * // Any authenticated user
 * const auth = await requireAuth(request);
 *
 * // Only admin
 * const auth = await requireAuth(request, "admin");
 *
 * // Admin or counselor
 * const auth = await requireAuth(request, "admin", "counselor");
 * ```
 */
export async function requireAuth(
  request: NextRequest,
  ...allowedRoles: UserRole[]
): Promise<AuthContext> {
  // First, authenticate the user
  const auth = await getAuthContext();

  // If no role restrictions, any authenticated user is allowed
  if (allowedRoles.length === 0) {
    return auth;
  }

  // Check if user's role is in the allowed roles
  if (!allowedRoles.includes(auth.role as UserRole)) {
    const roleList = allowedRoles.length === 1
      ? allowedRoles[0]
      : allowedRoles.join(" or ");
    throw APIError.forbidden(
      `Access denied. Required role: ${roleList}`
    );
  }

  return auth;
}
