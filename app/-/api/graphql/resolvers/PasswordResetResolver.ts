import { createToken } from "~/models/redisTokenAuths"
import { usersModel } from "~/models/users"
import hashPassword from "~/utils/hashPassword"

import { emailClient } from "./../clients/emailClient"
import { rateLimit } from "./../utils/rateLimit"
import { AuthResponse } from "./MeResolver"

import "reflect-metadata"

import logger from "@codeshare/log"
import AppError from "~/helpers/AppError"
import { emailsModel } from "~/models/emails"
import { getExpiresAt, passwordResetsModel } from "~/models/passwordResets"
import { decodeJWT, insecureDecodeJWT } from "~/utils/decodeJWT"
import { encodeJWT } from "~/utils/encodeJWT"
import generateSecret from "~/utils/generateSecret"
import { ignoreStatus } from "ignore-errors"
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
  UseMiddleware,
} from "type-graphql"

import { ResolverContextType } from "./getContext"
import Me from "./nodes/Me"

@InputType()
class SendPasswordResetInput {
  @Field()
  email!: string
  @Field({ nullable: true })
  clientMutationId?: string
}

@InputType()
class UsePasswordResetInput {
  @Field()
  email!: string
  @Field()
  resetToken!: string
  @Field()
  newPassword!: string
  @Field({ nullable: true })
  clientMutationId?: string
}

@ObjectType()
class SendPasswordResetResponse {
  @Field()
  sent!: boolean
}

@Resolver()
export default class PasswordResetResolver {
  @Mutation(() => SendPasswordResetResponse)
  @UseMiddleware(rateLimit("sendPasswordReset", 30))
  async sendPasswordReset(
    @Arg("input") { email }: SendPasswordResetInput,
    @Ctx() ctx: ResolverContextType,
  ) {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    if (!ctx.me.anonymous) {
      throw new AppError("already logged in", {
        status: 409,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const emailRow = await emailsModel.getOne("id", email)
    if (!emailRow) {
      throw new AppError<{ email: string }>("user with email not found", {
        email,
        status: 404,
      })
    }
    const [id, secret] = await Promise.all([
      passwordResetsModel.uuid(),
      generateSecret(),
    ])
    const { expiresAt } = await passwordResetsModel.insert({
      id,
      email,
      createdAt: new Date(),
      createdBy: {
        clientId: ctx.clientId,
        userId: ctx.me.id,
      },
      expiresAt: getExpiresAt(),
      secret,
    })
    const token = encodeJWT({ id, expiresAt }, secret)
    await emailClient.sendPasswordReset(email, token)
    return {
      sent: true,
    }
  }

  @Mutation(() => AuthResponse)
  @UseMiddleware(rateLimit("usePasswordReset", 30))
  async usePasswordReset(
    @Arg("input") { email, resetToken, newPassword }: UsePasswordResetInput,
    @Ctx() ctx: ResolverContextType,
  ): Promise<AuthResponse> {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    if (!ctx.me.anonymous) {
      throw new AppError("already logged in", {
        status: 409,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const payload = insecureDecodeJWT(resetToken)
    const passwordResetRow = await passwordResetsModel.getOne("id", payload.id)
    if (!passwordResetRow) {
      throw new AppError("token is invalid or expired", {
        status: 401,
        resetToken,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const { secret } = passwordResetRow
    try {
      decodeJWT(resetToken, secret)
    } catch (e) {
      const err = e as Error
      throw AppError.wrap(err, "token is invalid or expired", {
        status: 401,
        resetToken,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const emailRow = await emailsModel.getOne("id", email)
    if (!emailRow) {
      throw new AppError<{ email: string }>("user with email not found", {
        email,
        status: 404,
      })
    }
    const hashedPassword = await hashPassword(newPassword)
    let me = await usersModel
      .updateOne("id", emailRow.createdBy.userId, {
        password: hashedPassword,
        modifiedAt: new Date(),
        modifiedBy: {
          clientId: ctx.clientId,
          userId: ctx.me.id,
        },
      })
      .catch(ignoreStatus(404))
    if (me == null) {
      // legacy deleted user, restore it
      logger.debug("restore legacy user", { emailRow })
      try {
        me = await usersModel.insert({
          id: emailRow.createdBy.userId,
          anonymous: false,
          name: emailRow.id,
          password: hashedPassword,
          loginCount: 1,
          createdAt: emailRow.createdAt,
          modifiedAt: new Date(),
          modifiedBy: {
            clientId: "password-reset-restored",
            userId: ctx.me.id,
          },
        })
      } catch (err) {
        throw AppError.wrap(
          err as Error,
          "Inactive account could not be restored. Please contact support: hello@codeshare.io",
          {
            email,
            status: 500,
          },
        )
      }
    }
    const token = await createToken(ctx.clientId, me.id)
    return {
      viewer: { me: me as Me },
      token,
    }
  }
}
