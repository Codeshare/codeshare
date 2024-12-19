import { redisClient } from "./../clients/redisClient"
import { rateLimit } from "./../utils/rateLimit"

import "reflect-metadata"

import { memoErr } from "@/app/-/api/graphql/utils/memoError"
import idUtils from "@codeshare/id-utils"
import AppError from "~/helpers/AppError"
import codeHistoriesModel, {
  Row as CodeHistoryRow,
  decodeHistoryId,
} from "~/models/codeHistories"
import abortable from "abortable-generator"
import { GraphQLResolveInfo } from "graphql"
import GraphQLFirepadTextOperation from "graphql-firepad-text-operation"
import RedisPubSubEngine from "graphql-ioredis-subscriptions"
import parseFields from "graphql-parse-fields"
import r from "rethinkdb"
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  Info,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Publisher,
  PubSub,
  Resolver,
  Root,
  Subscription,
  UseMiddleware,
} from "type-graphql"

import {
  Row as CodeshareRow,
  codesharesModel,
  Fields,
} from "./../models/codeshares"
import { ResolverContextType } from "./getContext"
import CodeHistory, {
  CodeHistoryConnection,
  CodeHistoryEdge,
  TextOperationType,
} from "./nodes/CodeHistory"
import Codeshare from "./nodes/Codeshare"

type CodeHistoryJSON = Omit<CodeHistoryRow, "createdAt"> & {
  createdAt: string
}
interface CodeHistoryNotifyPayload {
  codeHistory: CodeHistoryJSON & {
    // extended
    historyIndex: number
  }
}

@InputType()
class CreateCodeHistoryInput {
  @Field()
  codeshareId!: string
  @Field()
  historyId!: string
  @Field(() => GraphQLFirepadTextOperation)
  value!: TextOperationType
  @Field({ nullable: true })
  clientMutationId?: string
}
@ObjectType()
export class CreateCodeHistoryResponse {
  @Field()
  codeshare!: Codeshare
  @Field(() => CodeHistoryEdge)
  newCodeHistoryEdge!: CodeHistoryEdge
}
type CreateCodeHistoryResult = Omit<
  CreateCodeHistoryResponse,
  "codeshare" | "newCodeHistoryEdge"
> & {
  codeshare: CodeshareRow
  newCodeHistoryEdge: Omit<CodeHistoryEdge, "node"> & {
    node: CodeHistoryRow
  }
}
// @InputType()
// class DeleteCodeHistoryInputType {
//   @Field()
//   id!: string
// }
// @ObjectType()
// export class DeleteCodeHistoryResponseType {
//   @Field()
//   id!: string
//   @Field()
//   me!: User
// }

@InputType()
class CodeHistoryCreationsInput {
  @Field()
  codeshareId!: string
  @Field({ nullable: true })
  after?: string
}
@ObjectType()
class CodeHistoryCreationsPayload {
  @Field()
  newCodeHistoryEdge!: CodeHistoryEdge
}
type CodeHistoryCreationsResult = Omit<
  CodeHistoryCreationsPayload,
  "newCodeHistoryEdge"
> & {
  newCodeHistoryEdge: Omit<CodeHistoryEdge, "node"> & {
    node: CodeHistoryRow
  }
}

enum topics {
  CREATED_CODE_HISTORY = "CREATED_CODE_HISTORY",
}

@Resolver(() => CodeHistory)
export class CodeshareCodeHistoryFieldResolver {
  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: Codeshare) {
    return idUtils.encodeRelayId("CodeHistory", root.id)
  }
}

@Resolver(() => Codeshare)
export default class CodeshareCodeHistoryResolver {
  @FieldResolver(() => CodeHistoryConnection)
  async codeHistory(
    @Root() codeshare: Codeshare,
    @Arg("after", { nullable: true }) after: string,
    @Arg("first", () => Int!) first: number,
    @Ctx() ctx: ResolverContextType,
  ): Promise<CodeHistoryConnection> {
    let checkpointCodeHistoryId = codeshare.codeCheckpoint?.codeHistoryId
    if (!codeshare.codeCheckpoint && !after) {
      const codeshare2 = await codesharesModel.getOne("id", codeshare.id, [
        "codeCheckpoint",
      ])
      if (!codeshare2) {
        throw new AppError("'codeshare' not found", { status: 404 })
      }
      checkpointCodeHistoryId = codeshare2.codeCheckpoint?.codeHistoryId
    }
    let checkpointHistoryId = checkpointCodeHistoryId?.split(":").pop()
    let checkpointHistoryIndex = checkpointHistoryId
      ? decodeHistoryId(checkpointHistoryId)
      : null
    const checkpointHistory = checkpointCodeHistoryId
      ? await codeHistoriesModel.getOne("id", checkpointCodeHistoryId, ["id"])
      : null
    if (checkpointHistory == null) {
      checkpointHistoryId = undefined
      checkpointHistoryIndex = null
    }
    let afterId = after ? idUtils.decodeRelayConnId(after) : checkpointHistoryId
    if (afterId != null) {
      // make sure we don't fetch too many code histories
      const afterIndex = decodeHistoryId(afterId)
      if (
        checkpointHistoryIndex != null &&
        !(afterIndex > checkpointHistoryIndex - 1000)
      ) {
        throw memoErr(
          "after must be gte checkpoint (query)",
          (msg) =>
            new AppError(msg, { cachedStack: `AppError: ${msg}` } as any),
          {
            message: valueDesc("after must be gte checkpoint (query)"),
            status: valueDesc(400),
            codeshareId: valueDesc(codeshare.id),
            checkpointHistoryIndex: valueDesc(checkpointHistoryIndex),
            afterIndex: valueDesc(afterIndex),
            checkpointHistoryId: valueDesc(checkpointHistoryId),
            afterId: valueDesc(afterId),
          },
        )
      }
    }
    if (afterId === checkpointCodeHistoryId && checkpointHistory == null) {
      afterId = undefined
    }
    const rows = await codeHistoriesModel.getBetween(
      "codeshareIdAndHistoryId",
      [
        // @ts-ignore
        [codeshare.id, afterId || r.minval],
        // @ts-ignore
        [codeshare.id, r.maxval],
      ],
      {
        page: {
          limit: first,
        },
        signal: new AbortController().signal,
      },
    )
    const edges = []
    for await (const codeHistory of rows) {
      edges.push({
        node: codeHistory as CodeHistory,
        cursor: idUtils.encodeRelayConnId(codeHistory.historyId),
      })
    }

    const hasNextPage = edges.length > first
    if (hasNextPage) {
      edges.pop()
    }

    const startEdge = edges[0]
    const endEdge = edges[edges.length - 1]

    return {
      edges,
      pageInfo: {
        startCursor: startEdge
          ? idUtils.encodeRelayConnId(startEdge.node.historyId)
          : undefined,
        endCursor: endEdge
          ? idUtils.encodeRelayConnId(endEdge.node.historyId)
          : undefined,
        hasNextPage,
        hasPreviousPage: Boolean(after),
      },
      count: edges.length,
    }
  }

  /**
   * Mutations
   */

  @Mutation(() => CreateCodeHistoryResponse)
  @UseMiddleware(rateLimit("createCodeHistory", 425))
  async createCodeHistory(
    @Arg("input")
    input: CreateCodeHistoryInput,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ): Promise<CreateCodeHistoryResult> {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })

    const codeshareId = idUtils.decodeRelayId("Codeshare", input.codeshareId)
    const fields = parseFields<{ codeshare: Fields }>(info)
    const codeshareFields: Fields = [
      ...(Object.keys(fields?.codeshare || []) as Fields),
      "canEdit",
      "createdBy",
    ]
    const codeshare = await codesharesModel.getOne(
      "id",
      codeshareId,
      codeshareFields,
    )
    // check exists
    if (!codeshare) {
      throw new AppError("'codeshare' not found", { status: 404 })
    }
    // check permissions
    if (
      codeshare?.createdBy.userId !== ctx.me.id &&
      codeshare?.canEdit?.userIds != null &&
      codeshare?.canEdit?.userIds?.length !== 0 &&
      !codeshare?.canEdit?.userIds?.includes(ctx.me.id)
    ) {
      throw new AppError("access denied", {
        status: 403,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    // validate the stuffs
    const codeHistory = await codeHistoriesModel.insert({
      id: `${codeshareId}:${input.historyId}`,
      codeshareId,
      createdAt: new Date(),
      createdBy: {
        clientId: ctx.clientId,
        userId: ctx.me.id,
      },
      historyId: input.historyId,
      value: input.value,
    })
    await (
      redisClient.pubSub as RedisPubSubEngine<CodeHistoryNotifyPayload>
    ).publish(`${topics.CREATED_CODE_HISTORY}:${codeshareId}`, {
      codeHistory: {
        ...toJSON(codeHistory),
        historyIndex: decodeHistoryId(codeHistory.historyId),
      },
    })

    return {
      codeshare,
      newCodeHistoryEdge: {
        node: codeHistory,
        cursor: idUtils.encodeRelayConnId(codeHistory.historyId),
      },
    }
  }

  /**
   * Subscriptions
   */
  @Subscription(() => CodeHistoryCreationsPayload, {
    subscribe(
      rootValue: any,
      args: { input: CodeHistoryCreationsInput },
      ctx: ResolverContextType,
    ) {
      AppError.assert(ctx.me, "not authenticated", { status: 401 })
      return abortable(async function* (raceAbort) {
        let pubSubPayloads: AsyncIterableIterator<CodeHistoryNotifyPayload> | null =
          null
        // @ts-ignore
        let codeHistories = null
        try {
          // get codeshare
          const codeshareId = idUtils.decodeRelayId(
            "Codeshare",
            args.input.codeshareId,
          )
          const codeshare = await raceAbort(
            codesharesModel.getOne("id", codeshareId),
          )
          AppError.assert(codeshare, '"codeshare" not found', {
            id: codeshareId,
            status: 404,
          })

          // get and validate checkpointHistoryId and afterId
          const checkpointCodeHistoryId =
            codeshare.codeCheckpoint?.codeHistoryId
          const checkpointHistoryId = checkpointCodeHistoryId?.split(":").pop()
          const checkpointHistoryIndex = checkpointHistoryId
            ? decodeHistoryId(checkpointHistoryId)
            : null
          const after = args.input.after
          const afterId = after
            ? idUtils.decodeRelayConnId(after)
            : checkpointHistoryId
          const afterIndex = afterId ? idUtils.decodeHistoryId(afterId) : null
          if (
            afterIndex != null &&
            checkpointHistoryIndex != null &&
            !(afterIndex > checkpointHistoryIndex - 1000)
          ) {
            throw memoErr(
              "after must be gte checkpoint (sub)",
              (msg) =>
                new AppError(msg, { cachedStack: `AppError: ${msg}` } as any),
              {
                message: valueDesc("after must be gte checkpoint (sub)"),
                status: valueDesc(400),
                codeshareId: valueDesc(codeshare.id),
                checkpointHistoryIndex: valueDesc(checkpointHistoryIndex),
                afterIndex: valueDesc(afterIndex),
                checkpointHistoryId: valueDesc(checkpointHistoryId),
                afterId: valueDesc(afterId),
              },
            )
          }

          // subscribe to pubsub
          // pubSubPayloads = await raceAbort((signal) =>
          //   redisClient.pubSub.asyncIterator<CodeHistoryNotifyPayload>(
          //     topics.CREATED_CODE_HISTORY,
          //     signal,
          //   ),
          // )
          pubSubPayloads = await raceAbort(
            (signal) =>
              redisClient.pubSub.asyncIterator<CodeHistoryNotifyPayload>(
                `${topics.CREATED_CODE_HISTORY}:${codeshareId}`,
                signal,
              ) as any as AsyncIterableIterator<CodeHistoryNotifyPayload>,
          )

          // get current codehistories
          codeHistories = await raceAbort((signal) =>
            codeHistoriesModel.getBetween(
              "codeshareIdAndHistoryId",
              [
                // @ts-ignore
                [codeshareId, afterId || r.minval],
                // @ts-ignore
                [codeshareId, r.maxval],
              ],
              {
                signal,
              },
            ),
          )

          // special ->
          // @ts-ignore
          // raceAbort(new Promise(() => {})).catch(() => codeHistories?.return())
          // <- special

          // yield current codehistories
          for await (const codeHistory of codeHistories) {
            yield { codeHistory }
          }

          // special ->
          // @ts-ignore
          // raceAbort(new Promise(() => {})).catch(() => pubSubPayloads?.return())
          // <- special

          // yield pubsub payloads
          for await (const payload of pubSubPayloads) {
            // filter out other codeshare updates
            if (payload.codeHistory.createdBy.clientId === ctx.clientId) {
              continue
            }
            const historyIndex = payload.codeHistory.historyIndex
            if (afterIndex != null && historyIndex < afterIndex) {
              continue
            }
            yield payload
          }
        } catch (err) {
          throw err
        } finally {
          // @ts-ignore
          pubSubPayloads?.return()
          // @ts-ignore
          codeHistories?.return()
        }
      })()
    },
  })
  async codeHistoryCreations(
    @Root() { codeHistory }: CodeHistoryNotifyPayload,
    @Arg("input") input: CodeHistoryCreationsInput,
  ): Promise<CodeHistoryCreationsResult> {
    return {
      newCodeHistoryEdge: {
        node: castDates(codeHistory),
        cursor: idUtils.encodeRelayConnId(codeHistory.historyId),
      },
    }
  }
}

function toJSON(ch: CodeHistoryRow): CodeHistoryJSON {
  return {
    ...ch,
    createdAt: ch.createdAt.toISOString(),
  }
}
function castDates(ch: CodeHistoryJSON): CodeHistoryRow {
  return {
    ...ch,
    createdAt: new Date(ch.createdAt),
  }
}
let id = 0
function getId(pre: string) {
  id++
  return pre + id
}

function valueDesc(value: unknown): PropertyDescriptor {
  return {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  }
}
