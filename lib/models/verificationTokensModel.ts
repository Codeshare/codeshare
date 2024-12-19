import { VERIFICATION_TOKEN_TTL } from "@/app/-/api/auth/[...nextauth]/auth.config"

import RedisModel from "@/lib/clients/redis/RedisModel"

type VerificationTokenModelRecord = {
  identifier: string
  token: string
  expiresAt: Date
}

export class VerificationTokenModel extends RedisModel<VerificationTokenModelRecord> {}

const verificationTokensModel = new VerificationTokenModel(
  "verificationTokens",
  {
    index: "identifier",
    ttl: VERIFICATION_TOKEN_TTL,
  },
)

export default verificationTokensModel
