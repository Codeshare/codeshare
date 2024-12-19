import { Generated } from "kysely"
import { ProviderType } from "next-auth/providers/index"

export default interface AccountSchema {
  id: Generated<string>
  type: ProviderType // string
  userId: string
  provider: string
  providerAccountId: string
  // optional
  accessToken: string | null
  expiresAt: Date | null
  idToken: string | null
  refreshToken: string | null
  scope: string | null
  sessionState: string | number | boolean | object | null // TODO: how to schema this?
  tokenType: string | null
}
