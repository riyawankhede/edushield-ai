import { NextResponse } from "next/server";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface APISuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export function apiSuccess<T>(data: T, meta?: PaginationMeta, status = 200): NextResponse {
  const body: APISuccessResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
  return NextResponse.json(body, { status });
}
