import { Generated } from "kysely"

export default interface UserSchema {
  id: Generated<string> // TODO: how to uuid?
  // anonymous: false
  createdAt: Date
  email: string // TODO: new field! unique index (only if verified?)
  // cleanedAt?: Date
  loginCount: number // TODO: incrementing?
  modifiedAt: Date
  modifiedBy: {
    userId: string
    clientId: string
  }
  password: string | null

  // optional
  emailVerified: Date | null
  name: string | null
  settings: {
    keymap?: string
    theme?: string
  } | null
  defaultCodeshareSettings: {
    modeName?: string // syntax
    tabSize?: string
  } | null
  // companyImage?: string
  // stripeCustomerId?: string
}
