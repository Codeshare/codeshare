"use client"

import { get } from "env-var"
import { __NEXTAUTH } from "next-auth/react"

import browserLogger from "@/lib/common/logger.browser"

const NEXTAUTH_URL = get("NEXTAUTH_URL").asString()
const NEXTAUTH_URL_INTERNAL = get("NEXTAUTH_URL_INTERNAL").asString()
const VERCEL_URL = get("VERCEL_URL").asString()

browserLogger.debug("auth.client.config.ts", __NEXTAUTH)
