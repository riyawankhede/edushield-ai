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
