import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  integer,
  jsonb,
  text
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  email: varchar('email').notNull().unique(),
  loginCount: integer('login_count').notNull().default(0),
  modifiedAt: timestamp('modified_at').defaultNow().notNull(),
  modifiedBy: jsonb('modified_by').notNull().$type<{
    userId: string
    clientId: string
  }>(),
  password: text('password'),

  // Optional fields
  emailVerified: timestamp('email_verified'),
  name: varchar('name'),
  settings: jsonb('settings').$type<{
    keymap?: string
    theme?: string
  }>(),
  defaultCodeshareSettings: jsonb('default_codeshare_settings').$type<{
    modeName?: string
    tabSize?: string
  }>(),
})

// Optionally create Zod schemas for type-safe inserts/selects
export const insertUserSchema = createInsertSchema(users)
export const selectUserSchema = createSelectSchema(users)

// Infer types from the table
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert


users.
