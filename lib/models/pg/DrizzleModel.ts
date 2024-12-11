import { sql, eq, and, between, desc, asc } from 'drizzle-orm'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import AppError from '@/lib/common/AppError'
import { singularize } from 'inflected'

export default class DrizzleModel<T extends Record<string, any>> {
  private db: PostgresJsDatabase
  private table: any // Replace with proper Drizzle table type
  tableName: string
  rowName: string

  constructor(db: PostgresJsDatabase, table: any) {
    this.db = db
    this.table = table
    this.tableName = table.name
    this.rowName = singularize(this.tableName)
  }

  async insert(data: Partial<T>): Promise<T> {
    try {
      const [result] = await this.db.insert(this.table)
        .values(data)
        .returning()
      return result
    } catch (err) {
      throw new AppError(`Failed to insert ${this.rowName}`)
    }
  }

  async getOne(where: Partial<T>): Promise<T | null> {
    try {
      const [result] = await this.db.select()
        .from(this.table)
        .where(and(...Object.entries(where).map(
          ([key, value]) => eq(this.table[key], value)
        )))
        .limit(1)
      return result || null
    } catch (err) {
      throw new AppError(`Failed to get ${this.rowName}`)
    }
  }

  async getWhere(
    where: Partial<T>,
    opts?: {
      limit?: number,
      offset?: number,
      orderBy?: { column: keyof T, direction: 'asc' | 'desc' }
    }
  ): Promise<T[]> {
    try {
      let query = this.db.select()
        .from(this.table)
        .where(and(...Object.entries(where).map(
          ([key, value]) => eq(this.table[key], value)
        )))

      if (opts?.limit) query = query.limit(opts.limit)
      if (opts?.offset) query = query.offset(opts.offset)
      if (opts?.orderBy) {
        const { column, direction } = opts.orderBy
        query = query.orderBy(
          direction === 'desc'
            ? desc(this.table[column as string])
            : asc(this.table[column as string])
        )
      }

      return await query
    } catch (err) {
      throw new AppError(`Failed to query ${this.rowName}`)
    }
  }

  async updateWhere(where: Partial<T>, data: Partial<T>): Promise<T[]> {
    try {
      return await this.db.update(this.table)
        .set(data)
        .where(and(...Object.entries(where).map(
          ([key, value]) => eq(this.table[key], value)
        )))
        .returning()
    } catch (err) {
      throw new AppError(`Failed to update ${this.rowName}`)
    }
  }

  async deleteWhere(where: Partial<T>): Promise<T[]> {
    try {
      return await this.db.delete(this.table)
        .where(and(...Object.entries(where).map(
          ([key, value]) => eq(this.table[key], value)
        )))
        .returning()
    } catch (err) {
      throw new AppError(`Failed to delete ${this.rowName}`)
    }
  }
}
