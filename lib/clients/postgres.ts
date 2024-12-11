import { createKysely } from "@vercel/postgres-kysely"
import { UsersTable } from "@/lib/models/usersModel"
import { AccountsTable } from "@/lib/models/accountsModel"

export interface CodeshareDB {
  accounts: AccountsTable
  users: UsersTable
}

const pg = createKysely<CodeshareDB>()

export default pg
