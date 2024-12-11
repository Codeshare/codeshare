import { Generated, Selectable, sql } from "kysely"
import PostgresModel, {
  PostgresModelError,
  PostgresModelErrorProps,
  PostgresOptsType,
} from "@/lib/models/pg/PostgresModel"
import pg, { CodeshareDB } from "@/lib/clients/postgres"
import { InsertObject } from "kysely"
import { SelectExpression, Selection } from "kysely"
import bcrypt from "bcrypt"

export class UsersModelError<
  Props extends PostgresModelErrorProps,
> extends PostgresModelError<Props> {}

export interface UsersTable {
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
export type UserRow = Selectable<UsersTable>
export type UserIndexes = Partial<Pick<UsersTable, "id" | "email">>
export type UserIndex = keyof UserIndexes

// aliases
type Row = UserRow
const ModelError: typeof UsersModelError = UsersModelError

export class UsersModel extends PostgresModel<
  CodeshareDB,
  "users",
  UserIndex,
  Omit<InsertObject<CodeshareDB, "users">, "id">
> {
  constructor() {
    super(pg, "users", ModelError)
  }

  static async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword)
    } catch (err) {
      throw UsersModelError.wrapWithStatus(err, 404, "invalid password")
    }
  }

  async insert<
    InsertData extends Omit<InsertObject<CodeshareDB, "users">, "id">,
    SE extends SelectExpression<CodeshareDB, "users">,
    S extends Selection<CodeshareDB, "users", SE>,
  >(
    data: InsertData,
    opts?: Omit<PostgresOptsType<SE, never>, "page">,
  ): Promise<S> {
    return super.insert(data, opts)
  }

  async getOneByEmail(email: string): Promise<Row | null> {
    return this.getOne("email", email, {
      signal: new AbortController().signal,
    })
  }

  async getOneByCredentials({
    email,
    password,
  }: {
    email: string
    password: string
  }): Promise<Row> {
    const user = await this.getOneByEmail(email)

    this.Error.assertWithStatus(user != null, 404, "email not found")
    this.Error.assertWithStatus(user.password != null, 404, "invalid password")

    // validate password
    UsersModel.comparePassword(password, user.password!)

    return user
  }

  // TODO: throw when not foundx?
  async incLoginCount(userId: string): Promise<Row | null> {
    return this.updateOne(
      "id",
      userId,
      {
        loginCount: sql`loginCount + 1`,
      },
      { signal: new AbortController().signal },
    )
  }
}

const usersModel = new UsersModel()

export default usersModel
