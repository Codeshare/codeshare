import { Pool } from "@neondatabase/serverless"
import { Kysely, PostgresDialect } from "kysely"

import DB from "./schemas"

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

export type CodeshareDB = DB

const pg = new Kysely<CodeshareDB>({
  dialect: new PostgresDialect({ pool }),
})

export default pg
