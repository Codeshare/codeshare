import NextAuth from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { IS_DEV } from "@/lib/const/const"

import authOptions from "./auth.config"

const { handlers } = NextAuth(authOptions)

export const GET = (req: NextRequest) => {
  if (IS_DEV) {
    // fallback to next.js default 404
    return NextResponse.next()
  }

  return handlers.GET(req)
}

export const POST = handlers.POST
