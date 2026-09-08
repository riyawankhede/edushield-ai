import { NextResponse } from "next/server";

export type APIErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "AI_SERVICE_ERROR"
  | "RATE_LIMITED";

export class APIError extends Error {
  public readonly code: APIErrorCode;
  public readonly httpStatus: number;
  public readonly details: unknown[];

  constructor(
    code: APIErrorCode,
    message: string,
    httpStatus: number = 500,
    details: unknown[] = []
  ) {
    super(message);
    this.name = "APIError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, APIError.prototype);
  }

  static unauthorized(message = "You are not authorized to access this resource.") {
    return new APIError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Access forbidden.") {
    return new APIError("FORBIDDEN", message, 403);
  }

  static notFound(message = "Resource not found.") {
    return new APIError("NOT_FOUND", message, 404);
  }

  static validationError(message = "Input validation failed.", details: unknown[] = []) {
    return new APIError("VALIDATION_ERROR", message, 422, details);
  }

  static conflict(message = "Duplicate resource.") {
    return new APIError("CONFLICT", message, 409);
  }

  static internal(message = "An unexpected error occurred.") {
    return new APIError("INTERNAL_ERROR", message, 500);
  }

  static aiServiceError(message = "AI/ML service is currently unavailable.") {
    return new APIError("AI_SERVICE_ERROR", message, 502);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json(
      { success: false, error: error.toJSON() },
      { status: error.httpStatus }
    );
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        details: [],
      },
    },
    { status: 500 }
  );
}
