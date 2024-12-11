import RedisModel from "@/lib/clients/RedisModel"

export type SessionRecord = {
  sessionToken: string
  userId: string
  expiresAt: Date
}

export class SessionsModel extends RedisModel<SessionRecord> {}

const sessionsModel = new SessionsModel("sessions", {
  index: "sessionToken",
})

export default sessionsModel
