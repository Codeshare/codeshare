// import AppError from "@/lib/common/AppError"
// import { JWTPayloadType, decodeJWT, insecureDecodeJWT } from "~/utils/decodeJWT"
// import { memoErr, valueDesc } from "../utils/memoError"

// import RedisModel from "./RedisModel"
// import { encodeJWT } from "~/utils/encodeJWT"
// import generateSecret from "~/utils/generateSecret"
// import { get } from "env-var"
// import { tokenAuthsModel as rethinkdbTokenAuthsModel } from "./tokenAuths"
// import { v4 } from "uuid"

// const TOKEN_DURATION = get("TOKEN_DURATION").required().asDuration()

// export type RowData = {
//   id: string
//   createdAt: Date
//   createdBy: {
//     userId: string
//     clientId: string
//   }
//   expiresAt: Date
//   secret: string
// }
// export type UpsertData = {
//   id: RowData["id"]
//   createdBy: RowData["createdBy"]
//   secret: RowData["secret"]
// }

// class TokenAuthsModelError extends AppError<{
//   token: string
//   payload: JWTPayloadType
// }> {}

// export class TokenAuthsModel extends RedisModel<RowData> {
//   constructor() {
//     super("token_auths", TOKEN_DURATION / 1000)
//   }

//   upsert(data: UpsertData): Promise<RowData> {
//     const nowDate = new Date()

//     return this._upsert({
//       ...data,
//       createdAt: new Date(),
//       expiresAt: getExpiresAt(),
//     })
//   }

//   async getOneByToken(token: string, throwIt?: boolean) {
//     const payload = insecureDecodeJWT(token)
//     const auth =
//       payload.v !== 2
//         ? // old token
//           await rethinkdbTokenAuthsModel.getOne("id", payload.id)
//         : // new token
//           await this.getOneById(payload.id)
//     if (!auth) {
//       throw memoErr(
//         "auth not found",
//         (msg) =>
//           new TokenAuthsModelError(msg, {
//             cachedStack: `TokenAuthsModelError: ${msg}`,
//           } as any),
//         {
//           status: valueDesc(401),
//           token: valueDesc(token),
//           payload: valueDesc(payload),
//           silent: valueDesc(true),
//         },
//       )
//     }
//     decodeJWT(token, auth.secret)
//     return auth
//   }

//   async deleteOneByToken(token: string) {
//     const payload = insecureDecodeJWT(token)
//     let deleted = false

//     // not necessary this is already checked before session..
//     // const auth =
//     //   payload.v !== 2
//     //     ? // old token
//     //       await rethinkdbTokenAuthsModel.getOne('id', payload.id)
//     //     : // new token
//     //       await this.getOneById(payload.id)

//     // if (auth == null) return deleted
//     // decodeJWT(token, auth.secret)

//     if (payload.v !== 2) {
//       // old token
//       const row = await rethinkdbTokenAuthsModel.deleteOne("id", payload.id)
//       deleted = Boolean(row)
//     } else {
//       // new token
//       deleted = await this.deleteOneById(payload.id)
//     }

//     // no need to error, just move on.
//     // if (!deleted) {
//     //   throw new TokenAuthsModelError('auth not found', {
//     //     status: 401,
//     //     token,
//     //     payload,
//     //   })
//     // }

//     return deleted
//   }
// }

// export const tokenAuthsModel = new TokenAuthsModel()

// export async function createToken(
//   clientId: string,
//   userId: string,
// ): Promise<string> {
//   const id = v4()
//   const secret = await generateSecret()

//   const tokenAuth = await tokenAuthsModel.upsert({
//     id,
//     createdBy: {
//       clientId,
//       userId,
//     },
//     secret,
//   })

//   return encodeJWT({ id, expiresAt: tokenAuth.expiresAt, v: 2 }, secret)
// }

// function getExpiresAt() {
//   return new Date(Date.now() + TOKEN_DURATION)
// }
