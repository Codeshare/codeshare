import { NextApiRequest } from "next"
import { NextRequest } from "next/server"

export default function getClientIp(
  req: NextApiRequest | NextRequest,
): string | null {
  const xForwardedForHeader = req.headers.get
    ? (req as NextRequest).headers.get("x-forwarded-for")
    : (req as NextApiRequest).headers["x-forwarded-for"]

  const xForwardedFor = Array.isArray(xForwardedForHeader)
    ? xForwardedForHeader[0]
    : xForwardedForHeader

  if (xForwardedFor == null) return null

  const matchResult = xForwardedFor.match(/^[^,]+/)

  if (matchResult == null) return null

  const clientIP = matchResult[0]

  return clientIP
}
