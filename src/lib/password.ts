/**
 * Password hashing and comparison utilities.
 *
 * Uses bcryptjs with a work factor of 12.
 * Never logs passwords or hashes.
 * Never stores or returns plaintext passwords.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Pre-computed dummy bcrypt hash for constant-time authentication.
 *
 * Used to prevent timing attacks during login attempts for nonexistent
 * or inactive users. By comparing against this hash, we ensure bcrypt
 * operations take similar time regardless of user existence.
 *
 * Hash of: "___dummy_password_for_timing_safety___"
 * Cost factor: 12 (matches SALT_ROUNDS)
 * This password does not correspond to any real user account.
 */
export const DUMMY_PASSWORD_HASH = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYBn7S6b5zO";

/**
 * Hash a plaintext password.
 * @returns The bcrypt hash string — safe to store in the database.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * @returns `true` if the password matches, `false` otherwise.
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
