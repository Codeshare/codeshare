// https://orm.drizzle.team/docs/get-started/neon-new install neonDataBase/serverless package

import { drizzle } from 'drizzle-orm/vercel-postgres';
import { neon } from 'drizzle-orm/neon-serverless';
//import { sql } from '@vercel/postgres';
import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
  integer,
  varchar,
} from 'drizzle-orm/pg-core';
 
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);


export const AccountTable = pgTable(
    'accounts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        type: text('type').notNull(),
        userId: text('userId').notNull(),
        provider: text('provider').notNull(),
        providerAccountId: text('providerAccountId').notNull(),
        accessToken: text('accessToken'),
        expiresAt: timestamp('expiresAt'),
        idToken: text('idToken'),
        refreshToken: text('refreshToken'),
        scope: text('scope'),
        sessionState: text('sessionState'),
        tokenType: text('tokenType'),
    }
)

