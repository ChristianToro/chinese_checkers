import { type NextRequest, NextResponse } from "next/server";

// Same name as SESSION_COOKIE in lib/session.ts. Proxy runs apart from the app,
// so it doesn't import app modules.
const SESSION_COOKIE = "cc_session";

/**
 * Optimistic check only: a missing cookie goes straight to sign-in. Whether
 * the session is valid is decided by the page, which reads the database.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const signIn = new URL("/", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: "/games/:path*",
};
