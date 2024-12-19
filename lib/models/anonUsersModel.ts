import { v4 } from "uuid"

import RedisModel from "@/lib/clients/redis/RedisModel"
import { get } from "@/lib/common/env/env"

import { UserRow } from "./usersModel"

const TOKEN_DURATION_MS = get("TOKEN_DURATION").required().asDuration()

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

  constructor() {
    super("anonUsers", { index: "id", ttl: TOKEN_DURATION_MS })
  }

  async create(): Promise<AnonUserRecord> {
    const anonUser = {
      id: AnonUsersModel.genAnonId(),
      createdAt: new Date(),
    }

    return this.upsert(anonUser)
  }
}

const anonUsersModel = new AnonUsersModel()

export default anonUsersModel
