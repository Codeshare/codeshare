import RedisModel from "@/lib/clients/RedisModel"

type VerificationTokenModelRecord = {
  identifier: string
  token: string
  expires: Date
}

export class VerificationTokenModel extends RedisModel<VerificationTokenModelRecord> {}

const verificationTokensModel = new VerificationTokenModel(
  "verificationTokens",
  {
    index: "identifier",
  },
)

export default verificationTokensModel
