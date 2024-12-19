import { Selectable } from "kysely"

import pg, { CodeshareDB } from "@/lib/clients/postgres/postgres"
import PostgresModel, {
  PostgresModelError,
  PostgresModelErrorProps,
} from "@/lib/clients/postgres/PostgresModel"
import AccountSchema from "@/lib/clients/postgres/schemas/account"

interface AccountsModelErrorProps extends PostgresModelErrorProps {
  provider: string
  providerAccountId: string
}
export class AccountsModelError extends PostgresModelError {}

export type AccountsTable = AccountSchema
export type AccountRow = Selectable<AccountsTable>
// export type InsertableAccountRow = Insertable<AccountsTable>
// export type UpdateableAccountRow = Updateable<AccountsTable>
export type AccountIndexes = Partial<
  Pick<AccountsTable, "id" | "userId" | "provider" | "providerAccountId">
>
export type AccountIndex = keyof AccountIndexes

// aliases
type Row = AccountRow
const ModelError = AccountsModelError

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
        provider: provider as string,
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
        provider: provider as string,
        providerAccountId,
      },
      {
        signal: new AbortController().signal,
        page: {
          limit: 1,
        },
      },
    )

    AccountsModelError.assertWithStatus<AccountsModelErrorProps>(
      row != null,
      404,
      `${this.rowName} not found`,
      {
        provider,
        providerAccountId,
      },
    )

    return row[0]
  }
}

const accountsModel = new AccountsModel()

export default accountsModel
