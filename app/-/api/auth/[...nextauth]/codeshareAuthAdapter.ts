import {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters"
import { ProviderType } from "next-auth/providers"

import AppError from "@/lib/common/AppError"
import accountsModel, { AccountRow } from "@/lib/models/accountsModel"
import sessionsModel from "@/lib/models/sessionsModel"
import usersModel from "@/lib/models/usersModel"
import verificationTokensModel from "@/lib/models/verificationTokensModel"
import ExactOmit from "@/lib/typeHelpers/ExactOmit"

function adapterAccountToRow(
  account: AdapterAccount,
): ExactOmit<AccountRow, "id"> {
  const {
    access_token: accessToken,
    expires_at: expiresAt,
    id_token: idToken,
    provider,
    providerAccountId,
    refresh_token: refreshToken,
    scope,
    session_state: sessionState,
    token_type: tokenType,
    type,
    userId,
  } = account

  return {
    accessToken: accessToken ?? null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    idToken: idToken ?? null,
    provider,
    providerAccountId,
    refreshToken: refreshToken ?? null,
    scope: scope ?? null,
    sessionState: sessionState ?? null,
    tokenType: tokenType ?? null,
    type,
    userId,
  }
}

function rowToAdapterAccount(row: AccountRow): AdapterAccount {
  const {
    accessToken,
    expiresAt,
    idToken,
    provider,
    providerAccountId,
    refreshToken,
    scope,
    sessionState,
    tokenType,
    type,
    userId,
  } = row

  return {
    access_token: accessToken ?? undefined,
    expires_at: expiresAt?.getTime() ?? undefined,
    id_token: idToken ?? undefined,
    provider,
    providerAccountId,
    refresh_token: refreshToken ?? undefined,
    scope: scope ?? undefined,
    session_state: sessionState ?? undefined,
    token_type: tokenType
      ? (tokenType.toLowerCase() as Lowercase<string>)
      : undefined,
    type: type as Extract<
      // TODO: why not credentials?
      ProviderType,
      "oauth" | "oidc" | "email" | "webauthn" | "codeshare_credentials"
    >,
    userId,
  }
}

function createCodeshareAuthAdapter(): Adapter {
  return {
    // Use Postgres for user management and accounts (persistent data)

    createUser: async (user: Omit<AdapterUser, "id">): Promise<AdapterUser> => {
      const { email } = user
      const existingUser = await usersModel.getBy("email", email)

      // TODO: consider making this atomic by parsing db collision error
      AppError.assertWithStatus(
        existingUser == null,
        409,
        "user with 'email' already exists",
      )

      return await usersModel.insert({
        ...user,
        createdAt: new Date(),
        loginCount: 0,
        modifiedAt: new Date(),
        modifiedBy: {
          clientId: "auth-adapter",
          userId: "auth-adapter",
        },
      })
    },

    getUser: async (id: string): Promise<AdapterUser | null> => {
      return await usersModel.getOne("id", id)
    },

    getUserByEmail: async (email: string): Promise<AdapterUser | null> => {
      return await usersModel.getOne("email", email)
    },

    getUserByAccount: async (
      providerInfo: Pick<AdapterAccount, "provider" | "providerAccountId">,
    ): Promise<AdapterUser | null> => {
      const { provider, providerAccountId } = providerInfo
      const account = await accountsModel.getOneByProviderAccount(
        provider,
        providerAccountId,
      )

      if (account == null) return null

      return await usersModel.getOne("id", account.userId)
    },

    linkAccount: async (
      accountInfo: AdapterAccount,
    ): Promise<AdapterAccount | null> => {
      const account = await accountsModel.insert(
        adapterAccountToRow(accountInfo),
      )
      // TODO: migrate anon user to user on registration

      return rowToAdapterAccount(account)
    },

    unlinkAccount: async (
      accountInfo: Pick<AdapterAccount, "provider" | "providerAccountId">,
    ): Promise<AdapterAccount | undefined> => {
      const { provider, providerAccountId } = accountInfo

      const account = await accountsModel.deleteOneByProviderAccount(
        provider,
        providerAccountId,
      )

      if (account == null) return

      return rowToAdapterAccount(account)
    },

    // Use Redis for session management and verification requests (ephemeral data)

    createSession: async ({
      expires,
      ...adapterSession
    }: AdapterSession): Promise<AdapterSession> => {
      const ttl = expires.getTime() / 1000 // seconds

      const session = await sessionsModel.upsert(adapterSession, { ttl })

      return mapFromRedis(session)
    },

    getSessionAndUser: async (
      sessionToken: string,
    ): Promise<{ session: AdapterSession; user: AdapterUser }> => {
      const session = await sessionsModel.getOneById(sessionToken)

      AppError.assertWithStatus(session != null, 401, "session not found", {
        sessionToken,
      })

      const user = await usersModel.getOne("id", session.userId)

      AppError.assertWithStatus(user != null, 404, "user not found", {
        userId: session.userId,
      })

      return {
        session: mapFromRedis(session),
        user,
      }
    },

    // TODO: not atomic
    updateSession: async <
      PartialAdapterSessionData extends Partial<AdapterSession> &
        Pick<AdapterSession, "sessionToken">,
    >({
      expires,
      ...adapterSessionData
    }: PartialAdapterSessionData): Promise<
      AdapterSession | null | undefined
    > => {
      const sessionRecord = await sessionsModel.getOneById(
        adapterSessionData.sessionToken,
      )

      if (sessionRecord == null) return null

      const { expiresAt, ...existingSessionData } = sessionRecord

      const newSessionData = adapterSessionData

      // TODO: how to partial update?
      const updatedSessionRow = await sessionsModel.upsert({
        ...existingSessionData,
        ...newSessionData,
      })

      return mapFromRedis(updatedSessionRow)
    },

    // note: not atomic
    deleteSession: async (sessionToken: string): Promise<AdapterSession> => {
      const sessionRow = await sessionsModel.getOneById(sessionToken)

      AppError.assertWithStatus(sessionRow != null, 404, "session not found", {
        sessionToken,
      })

      await sessionsModel.deleteOneById(sessionToken)

      return mapFromRedis(sessionRow)
    },

    createVerificationToken: async ({
      expires,
      ...adapterVerificationToken
    }: VerificationToken): Promise<VerificationToken> => {
      const ttl = expires.getTime() / 1000 // seconds

      const verificationToken = await verificationTokensModel.upsert(
        adapterVerificationToken,
        { ttl },
      )

      return mapFromRedis(verificationToken)
    },

    useVerificationToken: async ({
      identifier,
    }: {
      identifier: string
      token: string // TODO: this is not used
    }): Promise<VerificationToken | null> => {
      const verificationToken =
        await verificationTokensModel.getOneById(identifier)

      if (verificationToken == null) return null

      await verificationTokensModel.deleteOneById(identifier)

      return mapFromRedis(verificationToken)
    },
  }
}

/// `expires` to `expiresAt` conversion helpers

function mapFromRedis<T extends { expiresAt: Date }>(
  data: T,
): Omit<T, "expiresAt"> & { expires: Date } {
  const { expiresAt, ...rest } = data

  return {
    ...rest,
    expires: expiresAt,
  }
}

const codeshareAdapter = createCodeshareAuthAdapter()

export default codeshareAdapter
