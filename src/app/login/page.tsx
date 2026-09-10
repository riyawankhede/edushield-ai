"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

const ROLE_ROUTES: Record<string, string> = {
  admin: "/admin",
  teacher: "/teacher",
  parent: "/parent",
  student: "/student",
  counselor: "/counselor",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "loading" });

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // credentials: "same-origin" is the default for same-origin fetches;
        // the browser will store the HttpOnly cookie automatically.
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setState({
          status: "error",
          message: json?.error?.message ?? "Invalid email or password.",
        });
        return;
      }

      // Role comes from the response body (safe — it was set by the server
      // from the verified JWT payload, not from client input).
      const role: string = json.data?.user?.role ?? "";
      const destination = ROLE_ROUTES[role] ?? "/student";

      // Hard navigation ensures the server component tree re-renders and
      // picks up the new access_token HttpOnly cookie.
      router.push(destination);
    } catch {
      setState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  const isLoading = state.status === "loading";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">

        {/* ── Branding ──────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E2D5A] text-white shadow-md">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              EduShield AI
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Student Safety &amp; Academic Intelligence
            </p>
          </div>
        </div>

        {/* ── Card ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@edushield.org"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#1E2D5A] focus:ring-2 focus:ring-[#1E2D5A]/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#1E2D5A] focus:ring-2 focus:ring-[#1E2D5A]/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Error message */}
            {state.status === "error" && (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {state.message}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="mt-1 flex h-10 w-full items-center justify-center rounded-lg bg-[#1E2D5A] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a3f7a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2D5A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* ── Demo hint ─────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Demo password for all accounts:{" "}
          <span className="font-mono font-semibold text-slate-600">
            Password123!
          </span>
        </p>
      </div>
    </div>
  );
}
