import { NextRequest, NextResponse } from "next/server"

import serverLogger from "@/lib/common/logger/logger.server"

export async function middleware(request: NextRequest) {
  serverLogger.info("middleware:", {
    method: request.method,
    url: request.url,
    cookies: request.cookies.get("web.sid"),
  })
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next|img).*)", // Matches all routes excluding those starting with /_next and /img
    "/api/:path*", // Explicitly include API routes
  ],
}
