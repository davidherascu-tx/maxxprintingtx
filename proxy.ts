import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: send visitors without a session cookie to sign in.
// Pages verify the signed session themselves via getCurrentUser().
export function proxy(request: NextRequest) {
  if (!request.cookies.has("maxx_session")) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/checkout/:path*"],
};
