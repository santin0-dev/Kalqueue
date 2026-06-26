import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/", "/about", "/features", "/contact", "/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith("/api/auth") || pathname.startsWith("/api/register") || pathname.startsWith("/api/announcements")
  );

  if (isPublic) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string;

  if (pathname.startsWith("/patient") && role !== "PATIENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/doctor") && role !== "DOCTOR") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
