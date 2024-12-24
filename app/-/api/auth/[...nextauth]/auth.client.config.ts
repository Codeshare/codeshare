"use client"

import { get } from "env-var"
import { __NEXTAUTH } from "next-auth/react"

import browserLogger from "@/lib/common/logger/logger.browser"

const _NEXTAUTH_URL = get("NEXTAUTH_URL").asString()
const _NEXTAUTH_URL_INTERNAL = get("NEXTAUTH_URL_INTERNAL").asString()
const _VERCEL_URL = get("VERCEL_URL").asString()

browserLogger.debug("auth.client.config.ts", __NEXTAUTH)
