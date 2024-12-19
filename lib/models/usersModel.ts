import bcrypt from "bcrypt"
import {
  InsertObject,
  Selectable,
  SelectExpression,
  Selection,
  sql,
} from "kysely"

import pg, { CodeshareDB } from "@/lib/clients/postgres/postgres"
import PostgresModel, {
  PostgresModelError,
  PostgresModelErrorProps,
  PostgresOptsType,
} from "@/lib/clients/postgres/PostgresModel"
import UserSchema from "@/lib/clients/postgres/schemas/user"
import ExactOmit from "@/lib/typeHelpers/ExactOmit"

export class UsersModelError<
  Props extends PostgresModelErrorProps,
> extends PostgresModelError<Props> {}

export type UsersTable = UserSchema
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
  ExactOmit<InsertObject<CodeshareDB, "users">, "id">
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
    InsertData extends ExactOmit<InsertObject<CodeshareDB, "users">, "id">,
    SE extends SelectExpression<CodeshareDB, "users">,
    S extends Selection<CodeshareDB, "users", SE>,
  >(
    data: InsertData,
    opts?: ExactOmit<PostgresOptsType<SE, never>, "page">,
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
