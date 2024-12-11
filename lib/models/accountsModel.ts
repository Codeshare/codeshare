import { ProviderType } from "next-auth/providers/index"
import PostgresModel, {
  PostgresModelError,
  PostgresModelErrorProps,
} from "./pg/PostgresModel"
import { Generated, Selectable } from "kysely"
import pg, { CodeshareDB } from "@/lib/clients/postgres"

export class AccountsModelError<
  Props extends PostgresModelErrorProps,
> extends PostgresModelError<Props> {}

export interface AccountsTable {
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
export type AccountRow = Selectable<AccountsTable>
// export type InsertableAccountRow = Insertable<AccountsTable>
// export type UpdateableAccountRow = Updateable<AccountsTable>
export type AccountIndexes = Partial<
  Pick<AccountsTable, "id" | "userId" | "provider" | "providerAccountId">
>
export type AccountIndex = keyof AccountIndexes

// aliases
type Row = AccountRow
const ModelError: typeof AccountsModelError = AccountsModelError

export class AccountsModel extends PostgresModel<
  CodeshareDB,
  "accounts",
  AccountIndex
> {
  constructor() {
    super(pg, "accounts", ModelError)
  }

  async getOneByProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<Row | null> {
    const rows = await this.getWhere(
      {
        provider,
        providerAccountId,
      },
      {
        page: {
          limit: 1,
        },
        signal: new AbortController().signal,
      },
    )

    return rows[0] ?? null
  }

  async deleteOneByProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<Row> {
    const row = await this.deleteWhere(
      {
        provider,
        providerAccountId,
      },
      {
        signal: new AbortController().signal,
        page: {
          limit: 1,
        },
      },
    )

    ModelError.assertWithCode(row != null, 404, `${this.rowName} not found`, {
      provider,
      providerAccountId,
    })

    return row[0]
  }
}

const accountsModel = new AccountsModel()

export default accountsModel
