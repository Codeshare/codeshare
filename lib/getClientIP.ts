import { NextApiRequest } from "next"
import { NextRequest } from "next/server"

// TODO: make sure this is right ip..
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

// function getClientIp(xForwardedFor: string): string | null {
//   if (xForwardedFor == null) return null

//   const xForwardedForArray = xForwardedFor.split('')

//   if (xForwardedForArray.length < 2) return null

//   const clientIP = xForwardedForArray[xForwardedForArray.length - 2]

//   if (clientIP.length === 0) return null

//   return clientIP
// }
