import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { comparePassword, DUMMY_PASSWORD_HASH } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { apiSuccess } from "@/lib/api-response";
import { APIError, handleAPIError } from "@/lib/api-error";

// Validation schema for login request
const loginSchema = z.object({
  email: z.string().email("Invalid email format").trim(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      throw APIError.validationError("Invalid JSON in request body");
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      throw APIError.validationError("Validation failed", validation.error.issues);
    }

    const { email, password } = validation.data;

    // Find user by email (normalize to lowercase)
    // Explicitly select passwordHash since it has select: false
    const user = await User.findOne({
      email: email.toLowerCase().trim()
    }).select('+passwordHash').lean();

    // Determine the hash to compare against for constant-time authentication
    // If user doesn't exist or is inactive, use dummy hash to prevent timing attacks
    const hashToCompare = (user && user.isActive)
      ? user.passwordHash!
      : DUMMY_PASSWORD_HASH;

    // Always perform bcrypt comparison regardless of user existence/status
    // This prevents timing-based user enumeration
    const isPasswordValid = await comparePassword(password, hashToCompare);

    // Check authentication result and user status
    if (!user || !user.isActive || !isPasswordValid) {
      // Generic authentication error - don't reveal if user exists or account status
      throw APIError.unauthorized("Invalid email or password");
    }

    // Generate access token
    const accessToken = await signAccessToken({
      userId: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId.toString(),
    });

    // Update lastLoginAt
    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
    });

    // Prepare safe user object for response
    const safeUser = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      schoolId: user.schoolId.toString(),
    };

    // Create response with secure cookie
    const response = apiSuccess({ user: safeUser });

    // Set access token in secure cookie
    // 15 minutes = 900 seconds (matching JWT expiry)
    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 900, // 15 minutes in seconds
    });

    return response;
  } catch (error) {
    return handleAPIError(error);
  }
}