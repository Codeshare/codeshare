import RedisModel from "@/lib/clients/redis/RedisModel"
import { get } from "@/lib/common/env/env"

const TOKEN_DURATION_MS = get("TOKEN_DURATION").required().asDuration()

export type SessionRecord = {
  sessionToken: string
  userId: string
  expiresAt: Date
}

export class SessionsModel extends RedisModel<SessionRecord> {
  constructor() {
    super("sessions", { index: "sessionToken", ttl: TOKEN_DURATION_MS })
  }
}

const sessionsModel = new SessionsModel()

export default sessionsModel
