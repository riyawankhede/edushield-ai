import { hashPassword, comparePassword } from "@/lib/password";

describe("password utilities", () => {
  const PLAINTEXT = "SuperSecret@99";

  describe("hashPassword", () => {
    it("returns a non-empty string", async () => {
      const hash = await hashPassword(PLAINTEXT);
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("produces a bcrypt hash (starts with $2a$ or $2b$)", async () => {
      const hash = await hashPassword(PLAINTEXT);
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    });

    it("uses cost factor 12", async () => {
      const hash = await hashPassword(PLAINTEXT);
      // bcrypt format: $2b$<cost>$...
      const costFactor = parseInt(hash.split("$")[2], 10);
      expect(costFactor).toBe(12);
    });

    it("produces a different hash on each call (salt randomness)", async () => {
      const hash1 = await hashPassword(PLAINTEXT);
      const hash2 = await hashPassword(PLAINTEXT);
      expect(hash1).not.toBe(hash2);
    });

    it("does not return the plaintext password", async () => {
      const hash = await hashPassword(PLAINTEXT);
      expect(hash).not.toBe(PLAINTEXT);
      expect(hash).not.toContain(PLAINTEXT);
    });
  });

  describe("comparePassword", () => {
    it("returns true for matching password and hash", async () => {
      const hash = await hashPassword(PLAINTEXT);
      const result = await comparePassword(PLAINTEXT, hash);
      expect(result).toBe(true);
    });

    it("returns false for wrong password", async () => {
      const hash = await hashPassword(PLAINTEXT);
      const result = await comparePassword("WrongPassword1", hash);
      expect(result).toBe(false);
    });

    it("returns false for empty string against real hash", async () => {
      const hash = await hashPassword(PLAINTEXT);
      const result = await comparePassword("", hash);
      expect(result).toBe(false);
    });

    it("returns false for correct password against different hash", async () => {
      const otherHash = await hashPassword("AnotherPassword1");
      const result = await comparePassword(PLAINTEXT, otherHash);
      expect(result).toBe(false);
    });
  });
});
