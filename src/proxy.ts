import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session-token";

/**
 * Quick first check: visitors without a session cookie are sent to sign in.
 * This only looks at the cookie. The real check (against the database)
 * happens in every data read and Server Action through `requireUser`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  // Server Actions and other non-page requests are checked by requireUser itself.
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
