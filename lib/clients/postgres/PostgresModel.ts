import { singularize } from "inflected"
import {
  DeleteQueryBuilder,
  DeleteResult,
  FilterObject,
  InsertObject,
  InsertQueryBuilder,
  Kysely,
  OperandValueExpressionOrList,
  OrderByExpression,
  ReferenceExpression,
  Selectable,
  SelectExpression,
  Selection,
  SelectQueryBuilder,
  sql,
  UpdateObject,
  UpdateQueryBuilder,
  UpdateResult,
} from "kysely"

import AppError, {
  AppErrorProps,
  ErrorShape,
  RequiredAppErrorProps,
} from "@/lib/common/AppError"

// @eslint-disable-next-line @typescript-eslint/no-empty-object
export type PostgresModelErrorProps = AppErrorProps
export interface QueryOneErrorProps extends PostgresModelErrorProps {
  index: string
  value: string
}
export interface QueryManyErrorProps extends PostgresModelErrorProps {
  filter: string
  data?: object
}

interface PostgresErrorShape extends ErrorShape {
  code?: string
}

export class PostgresModelError<
  Props extends PostgresModelErrorProps = PostgresModelErrorProps,
> extends AppError<Props> {
  constructor(message: string, props?: Props) {
    super(message, props)
  }

  static wrapPostgresError<
    ExtraProps extends PostgresModelErrorProps = PostgresModelErrorProps,
  >(
    source: PostgresErrorShape,
    message: string | ((status: number) => string),
    data?: ExtraProps,
  ): AppError {
    const status = this.mapPostgresErrorCodeToHttpStatus(source)
    const errMessage = typeof message === "function" ? message(status) : message

    return this.wrap<RequiredAppErrorProps>(source, errMessage, {
      code: this.codeFromStatus(status),
      status,
      ...data,
    })
  }

  /* static helper methods */

  static mapPostgresErrorCodeToHttpStatus(err: PostgresErrorShape): number {
    if (err.code == null) return 500

    switch (err.code) {
      case "23505":
        return 409
      case "23502":
      case "23503":
      case "22001":
      case "22007":
      case "22P02":
      case "42703":
      case "42P01":
      case "23514":
        return 400
      default:
        return 500
    }
  }
}

type PostgresModelErrorClassType = {
  new (
    ...args: ConstructorParameters<typeof PostgresModelError>
  ): PostgresModelError<PostgresModelErrorProps>
} & typeof PostgresModelError<PostgresModelErrorProps>

type PageOptsType<OE> = {
  skip?: number
  limit?: number
  sortBy?: OE
}

export type PostgresOptsType<
  SE,
  OE,
  PagePick extends keyof PageOptsType<OE> = keyof PageOptsType<OE>,
> = {
  signal?: AbortSignal
  fields?: SE
  page?: Pick<PageOptsType<OE>, PagePick>
}

export default class PostgresModel<
  DB,
  TE extends keyof DB & string,
  RE extends ReferenceExpression<DB, TE> = ReferenceExpression<DB, TE>,
  IE extends InsertObject<DB, TE> = InsertObject<DB, TE>,
  Row extends Selectable<DB[TE]> = Selectable<DB[TE]>,
  // UpdateableRow extends Partial<InsertableRow>,
> {
  private pg: Kysely<DB>
  tableName: TE
  rowName: string
  rowNamePlural: string
  protected Error: PostgresModelErrorClassType

  constructor(
    pg: Kysely<DB>,
    tableName: TE,
    Error: PostgresModelErrorClassType,
  ) {
    this.pg = pg
    this.tableName = tableName
    this.rowName = singularize(tableName as string)
    this.rowNamePlural = tableName as string
    this.Error = Error
  }

  async insert<
    InsertData extends IE,
    SE extends SelectExpression<DB, TE>,
    S extends Selection<DB, TE, SE>,
  >(
    data: InsertData,
    opts?: Omit<PostgresOptsType<SE, never>, "page">,
  ): Promise<S> {
    try {
      let query = this.pg.insertInto<TE>(
        this.tableName,
      ) as unknown as InsertQueryBuilder<DB, TE, S>

      query = query.values(data)
      if (opts?.fields) {
        query = query.returning(opts.fields) as unknown as InsertQueryBuilder<
          DB,
          TE,
          S
        >
      }

      return await query.executeTakeFirstOrThrow()
    } catch (err) {
      throw this.Error.wrapPostgresError(
        err as PostgresErrorShape,
        `Failed to insert ${this.rowName}`,
      )
    }
  }

  async getOne<
    VE extends OperandValueExpressionOrList<
      DB,
      TE,
      RE
    > = OperandValueExpressionOrList<DB, TE, RE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, Row> = OrderByExpression<DB, TE, Row>,
  >(
    index: RE,
    value: VE,
    opts?: PostgresOptsType<SE, OE>,
  ): Promise<Row | null> {
    try {
      const rows = await this.getBy(index, value, {
        ...opts,
        page: { ...opts?.page, limit: 1 },
      })

      return rows[0] ?? null
    } catch (err) {
      if (!(err instanceof PostgresModelError)) {
        // shouldn't happen
        throw err
      }
      throw this.Error.wrapPostgresError(
        err.source as PostgresErrorShape,
        `Failed to get ${this.rowName}`,
      )
    }
  }

  async getBy<
    VE extends OperandValueExpressionOrList<DB, TE, RE>,
    SE extends SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, Row>,
  >(index: RE, value: VE, opts?: PostgresOptsType<SE, OE>): Promise<Row[]> {
    return this.getWhere(
      {
        [index.toString()]: value,
      } as FilterObject<DB, TE>,
      opts,
    )
  }

  async getWhere<
    // FO extends ExpressionOrFactory<DB, TE, SqlBool>,
    FO extends FilterObject<DB, TE>,
    SE extends SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, Row>,
  >(filter: FO, opts?: PostgresOptsType<SE, OE>): Promise<Row[]> {
    type QueryForRow = SelectQueryBuilder<DB, TE, Row>

    try {
      let query = this.pg.selectFrom<TE>(this.tableName) as QueryForRow

      if (opts?.fields != null) query = query.select<SE>(opts.fields)
      if (opts?.page != null) {
        const { skip, limit, sortBy } = opts.page
        if (skip != null) query = query.offset(skip)
        if (limit != null) query = query.limit(limit)
        if (sortBy != null) query = query.orderBy(sortBy as unknown as OE[]) // HACK: ts workaround
      }

      return await query.where((eb) => eb.and(filter)).execute()
    } catch (err) {
      throw this.Error.wrapPostgresError(
        err as PostgresErrorShape,
        `Failed to query ${this.rowNamePlural}`,
      )
    }
  }

  async getBetween<
    StartVE extends OperandValueExpressionOrList<DB, TE, RE>,
    EndVE extends OperandValueExpressionOrList<DB, TE, RE>,
    SE extends SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, Row>,
  >(
    index: RE,
    start: StartVE,
    end: EndVE,
    opts: {
      signal: AbortSignal
      fields?: SE
      page?: PageOptsType<OE>
    },
  ): Promise<Row[]> {
    try {
      let query = this.pg.selectFrom<TE>(this.tableName) as SelectQueryBuilder<
        DB,
        TE,
        Row
      >

      if (opts.fields != null) query = query.select<SE>(opts.fields)
      if (opts.page != null) {
        const { skip, limit, sortBy } = opts.page
        if (skip != null) query = query.offset(skip)
        if (limit != null) query = query.limit(limit)
        if (sortBy != null) query = query.orderBy(sortBy as unknown as OE[]) // HACK: ts workaround
      }

      return await query
        .where(index, ">", start) // NOTE: leftBound: open.. weird
        .where(index, "<=", end)
        .execute()
    } catch (err) {
      throw this.Error.wrapPostgresError(
        err as PostgresErrorShape,
        `Failed to query range of ${this.rowNamePlural}`,
      )
    }
  }

  async countBy<
    VE extends OperandValueExpressionOrList<DB, TE, RE>,
    OE extends OrderByExpression<DB, TE, number>,
  >(index: RE, value: VE, opts?: PostgresOptsType<never, OE>): Promise<number> {
    type QueryForRow = SelectQueryBuilder<DB, TE, Row>
    type QueryForCount = SelectQueryBuilder<DB, TE, number>

    try {
      let query = (
        this.pg.selectFrom<TE>(this.tableName) as QueryForRow
      ).select(sql<number>`count(*)`.as("count")) as QueryForCount

      if (opts?.page != null) {
        const { skip, limit, sortBy } = opts.page
        if (skip != null) query = query.offset(skip)
        if (limit != null) query = query.limit(limit)
        if (sortBy != null) query = query.orderBy(sortBy as unknown as OE[]) // HACK: ts workaround
      }

      return await query.where(index, "=", value).executeTakeFirstOrThrow()
    } catch (err) {
      throw this.Error.wrapPostgresError(
        err as PostgresErrorShape,
        `Failed to count ${this.rowNamePlural}`,
      )
    }
  }

  async updateOne<
    VE extends OperandValueExpressionOrList<
      DB,
      TE,
      RE
    > = OperandValueExpressionOrList<DB, TE, RE>,
    UO extends UpdateObject<DB, TE> = UpdateObject<DB, TE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
  >(
    index: RE,
    value: VE,
    data: UO,
    opts?: Omit<PostgresOptsType<SE, never>, "page">,
  ): Promise<Row> {
    const rows = await this.updateBy(index, value, data, {
      ...opts,
      page: { limit: 1 },
    }).catch((err) => {
      if (!(err instanceof PostgresModelError)) {
        // shouldn't happen, all errors will be wrapped already
        throw err
      }
      throw this.Error.wrapPostgresError(
        err.source as PostgresErrorShape,
        `Failed to update ${this.rowName}`,
      )
    })

    this.Error.assertWithStatus<QueryOneErrorProps>(
      rows[0] != null,
      404,
      `Failed to update: ${this.rowName} not found`,
      { index: index.toString(), value: value.toString() },
    )

    return rows[0]
  }

  async updateBy<
    VE extends OperandValueExpressionOrList<
      DB,
      TE,
      RE
    > = OperandValueExpressionOrList<DB, TE, RE>,
    UO extends UpdateObject<DB, TE> = UpdateObject<DB, TE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
  >(
    index: RE,
    value: VE,
    data: UO,
    opts?: PostgresOptsType<SE, never, "limit">,
  ): Promise<Row[]> {
    return this.updateWhere(
      {
        [index.toString()]: value,
      } as FilterObject<DB, TE>,
      data,
      opts,
    )
  }

  async updateWhere<
    FO extends FilterObject<DB, TE> = FilterObject<DB, TE>,
    UO extends UpdateObject<DB, TE> = UpdateObject<DB, TE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
  >(
    filter: FO,
    data: UO,
    opts?: PostgresOptsType<SE, never, "limit">,
  ): Promise<Row[]> {
    type QueryForResult = UpdateQueryBuilder<DB, TE, TE, UpdateResult>
    type QueryForRow = UpdateQueryBuilder<DB, TE, TE, Row>

    try {
      let query = (
        this.pg.updateTable<TE>(
          this.tableName,
          // HACK: ts workaround
        ) as unknown as QueryForResult
      )
        .set(data)
        .where((eb) => eb.and(filter))

      if (opts?.page != null) {
        const { limit } = opts.page
        if (limit != null) query = query.limit(limit)
      }

      return await (
        (opts?.fields == null
          ? query.returningAll()
          : query.returning(opts.fields as SE)) as QueryForRow
      ).execute()
    } catch (err) {
      throw this.Error.wrapPostgresError<QueryManyErrorProps>(
        err as PostgresErrorShape,
        `Failed to update ${this.tableName}`,
        { filter: JSON.stringify(filter), data },
      )
    }
  }

  async deleteOne<
    VE extends OperandValueExpressionOrList<DB, TE, RE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, DeleteResult> = OrderByExpression<
      DB,
      TE,
      DeleteResult
    >,
  >(
    index: RE,
    value: VE,
    opts?: PostgresOptsType<SE, OE, "sortBy">,
  ): Promise<Row> {
    const rows = await this.deleteBy(index, value, {
      ...opts,
      page: {
        ...opts?.page,
        limit: 1,
      },
    }).catch((err) => {
      if (!(err instanceof PostgresModelError)) {
        // shouldn't happen, all errors will be wrapped already
        throw err
      }
      throw this.Error.wrapPostgresError(
        err.source as PostgresErrorShape,
        `Failed to delete ${this.rowName}`,
      )
    })

    this.Error.assertWithStatus<QueryOneErrorProps>(
      rows[0] != null,
      404,
      `Failed to delete: ${this.rowName} not found`,
      { index: index.toString(), value: value.toString() },
    )

    return rows[0]
  }

  async deleteBy<
    VE extends OperandValueExpressionOrList<DB, TE, RE>,
    FO extends FilterObject<DB, TE> = FilterObject<DB, TE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, DeleteResult> = OrderByExpression<
      DB,
      TE,
      DeleteResult
    >,
  >(
    index: RE,
    value: VE,
    opts?: PostgresOptsType<SE, OE, "limit" | "sortBy">,
  ): Promise<Row[]> {
    return this.deleteWhere(
      {
        [index.toString()]: value,
      } as FO,
      opts,
    )
  }

  async deleteWhere<
    FO extends FilterObject<DB, TE> = FilterObject<DB, TE>,
    SE extends SelectExpression<DB, TE> = SelectExpression<DB, TE>,
    OE extends OrderByExpression<DB, TE, DeleteResult> = OrderByExpression<
      DB,
      TE,
      DeleteResult
    >,
  >(
    filter: FO,
    opts?: PostgresOptsType<SE, OE, "limit" | "sortBy">,
  ): Promise<Row[]> {
    type QueryForDeleteResult = DeleteQueryBuilder<DB, TE, DeleteResult>
    type QueryForRow = DeleteQueryBuilder<DB, TE, Row>

    try {
      let query = (
        this.pg.deleteFrom<TE>(this.tableName) as QueryForDeleteResult
      ).where((eb) => eb.and(filter))

      if (opts?.page != null) {
        const { limit, sortBy } = opts.page
        if (limit != null) query = query.limit(limit)
        if (sortBy != null) query = query.orderBy(sortBy as OE)
      }

      return await (
        (opts?.fields == null
          ? query.returningAll()
          : query.returning(opts.fields as SE)) as QueryForRow
      ).execute()
    } catch (err) {
      throw this.Error.wrapPostgresError<QueryManyErrorProps>(
        err as PostgresErrorShape,
        `Failed to delete ${this.tableName}`,
        { filter: JSON.stringify(filter) },
      )
    }
  }
}
