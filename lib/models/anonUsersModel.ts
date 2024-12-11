import RedisModel from "@/lib/clients/RedisModel"
import { v4 } from "uuid"
import { UserRow } from "./usersModel"
import getEnvAsDuration from "../utils/getEnvAsDuration"

const TOKEN_DURATION_MS = getEnvAsDuration("TOKEN_DURATION")

export type AnonUserRecord = {
  id: UserRow["id"]
  createdAt: UserRow["createdAt"]
  modifiedAt?: UserRow["modifiedAt"]
  expiresAt: Date
  settings?: UserRow["settings"]
}

export class AnonUsersModel extends RedisModel<AnonUserRecord> {
  static ANON_NAMESPACE = "anon:"
  static isAnonUserId(id: string) {
    return id.startsWith(this.ANON_NAMESPACE)
  }
  static isAnonId(id: string): boolean {
    return id.startsWith(this.ANON_NAMESPACE)
  }
  static removeAnonNamespace(id: string): string {
    return id.replace(this.ANON_NAMESPACE, "")
  }
  static prependAnonNamespace(id: string): string {
    if (this.isAnonId(id)) return id
    return this.ANON_NAMESPACE + id
  }
  static genAnonId() {
    return this.prependAnonNamespace(v4())
  }
  async create(): Promise<AnonUserRecord> {
    const anonUser = {
      id: AnonUsersModel.genAnonId(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + TOKEN_DURATION_MS),
    }

    return this.upsert(anonUser)
  }
}

const anonUsersModel = new AnonUsersModel("anonUsers", {
  index: "id",
})

export default anonUsersModel
