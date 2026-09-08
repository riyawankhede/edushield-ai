import { signAccessToken, verifyAccessToken } from "@/lib/jwt";
import type { AccessTokenPayload } from "@/lib/jwt";

// Set the secret before any test runs
const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";

beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

const SAMPLE_PAYLOAD: AccessTokenPayload = {
  userId: "64a1b2c3d4e5f6a7b8c9d0e1",
  role: "teacher",
  schoolId: "64a1b2c3d4e5f6a7b8c9d0e0",
};

describe("JWT utilities", () => {
  describe("signAccessToken", () => {
    it("returns a non-empty string token", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD);
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("produces a three-part JWT (header.payload.signature)", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD);
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    it("header declares alg=HS256", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD);
      const headerJson = Buffer.from(token.split(".")[0], "base64url").toString();
      const header = JSON.parse(headerJson);
      expect(header.alg).toBe("HS256");
    });
  });

  describe("verifyAccessToken", () => {
    it("returns the correct userId, role, schoolId", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD);
      const decoded = await verifyAccessToken(token);
      expect(decoded.userId).toBe(SAMPLE_PAYLOAD.userId);
      expect(decoded.role).toBe(SAMPLE_PAYLOAD.role);
      expect(decoded.schoolId).toBe(SAMPLE_PAYLOAD.schoolId);
    });

    it("includes exp and iat standard claims", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD);
      const decoded = await verifyAccessToken(token);
      expect(typeof decoded.exp).toBe("number");
      expect(typeof decoded.iat).toBe("number");
    });

    it("exp is ~15 minutes after iat", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD);
      const decoded = await verifyAccessToken(token);
      const diffSeconds = decoded.exp! - decoded.iat!;
      // 15 minutes = 900 seconds — allow ±5s for test timing
      expect(diffSeconds).toBeGreaterThanOrEqual(895);
      expect(diffSeconds).toBeLessThanOrEqual(905);
    });

    it("rejects a token signed with a different secret", async () => {
      // Sign with a different secret manually
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("completely-different-secret-value!");
      const badToken = await new SignJWT({ userId: "x", role: "admin", schoolId: "y" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      await expect(verifyAccessToken(badToken)).rejects.toThrow();
    });

    it("rejects a plainly malformed string", async () => {
      await expect(verifyAccessToken("not.a.jwt")).rejects.toThrow();
    });

    it("rejects an empty string", async () => {
      await expect(verifyAccessToken("")).rejects.toThrow();
    });

    it("rejects an expired token", async () => {
      // Build a token that expired 1 second ago
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = await new SignJWT({
        userId: "abc",
        role: "student",
        schoolId: "def",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 120)
        .setExpirationTime(now - 1) // already expired
        .sign(secret);

      await expect(verifyAccessToken(expiredToken)).rejects.toThrow();
    });

    it("rejects a token with missing required claims", async () => {
      // Sign a token that lacks userId/role/schoolId
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const incompleteToken = await new SignJWT({ someOtherField: "value" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      await expect(verifyAccessToken(incompleteToken)).rejects.toThrow();
    });
  });

  describe("missing secret", () => {
    it("signAccessToken throws clearly when ACCESS_TOKEN_SECRET is unset", async () => {
      const saved = process.env.ACCESS_TOKEN_SECRET;
      delete process.env.ACCESS_TOKEN_SECRET;
      await expect(signAccessToken(SAMPLE_PAYLOAD)).rejects.toThrow(
        /ACCESS_TOKEN_SECRET/
      );
      process.env.ACCESS_TOKEN_SECRET = saved;
    });

    it("verifyAccessToken throws clearly when ACCESS_TOKEN_SECRET is unset", async () => {
      const token = await signAccessToken(SAMPLE_PAYLOAD); // sign while secret is set
      const saved = process.env.ACCESS_TOKEN_SECRET;
      delete process.env.ACCESS_TOKEN_SECRET;
      await expect(verifyAccessToken(token)).rejects.toThrow(
        /ACCESS_TOKEN_SECRET/
      );
      process.env.ACCESS_TOKEN_SECRET = saved;
    });
  });
});
