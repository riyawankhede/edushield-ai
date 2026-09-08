/**
 * JWT utilities for access tokens.
 *
 * Algorithm : HS256
 * Expiration : 15 minutes
 * Secret     : ACCESS_TOKEN_SECRET environment variable (server-side only)
 *
 * Never log tokens.
 * Never expose the secret to the client.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { UserRole } from "@/types/identity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  /** MongoDB ObjectId string of the User document */
  userId: string;
  /** RBAC role */
  role: UserRole;
  /** MongoDB ObjectId string of the School document — enforces tenant isolation */
  schoolId: string;
}

/** The full decoded payload including standard JWT claims */
export type DecodedAccessToken = AccessTokenPayload & JWTPayload;

// ---------------------------------------------------------------------------
// Secret resolution — fail fast at call-time, not at module load
// (module-level evaluation runs in both server and edge contexts)
// ---------------------------------------------------------------------------

function getSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "[jwt] ACCESS_TOKEN_SECRET environment variable is not set. " +
        "Add it to .env.local before using authentication."
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = "HS256" as const;
const ACCESS_TOKEN_EXPIRY = "15m";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sign and return a new access token for the given payload.
 * Expiry: 15 minutes.
 */
export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  const secret = getSecret();
  return new SignJWT({
    userId: payload.userId,
    role: payload.role,
    schoolId: payload.schoolId,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * Verify an access token and return its decoded payload.
 *
 * Throws if the token is:
 *  - missing or malformed
 *  - signed with a different secret
 *  - expired
 *  - using an unexpected algorithm
 */
export async function verifyAccessToken(
  token: string
): Promise<DecodedAccessToken> {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret, {
    algorithms: [ALGORITHM],
  });

  // Runtime shape validation — jwtVerify only guarantees JWTPayload
  if (
    typeof payload["userId"] !== "string" ||
    typeof payload["role"] !== "string" ||
    typeof payload["schoolId"] !== "string"
  ) {
    throw new Error("[jwt] Access token payload is missing required claims.");
  }

  return payload as DecodedAccessToken;
}
