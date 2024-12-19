// import GoogleProvider from "next-auth/providers/google"
import { get } from "env-var"
import { CredentialsSignin, NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Nodemailer from "next-auth/providers/nodemailer"
import { z } from "zod"

import { IS_DEV } from "@/lib/const/const"
import usersModel from "@/lib/models/usersModel"

import codeshareAdapter from "./codeshareAuthAdapter"

// const GOOGLE_ID = get("GOOGLE_ID").required().asString()
// const GOOGLE_SECRET = get("GOOGLE_SECRET").required().asString()
const NEXTAUTH_SECRET = get("NEXTAUTH_SECRET").required().asString()
const NEXTAUTH_URL = get("NEXTAUTH_URL").asString()
console.log("NEXTAUTH_URL", NEXTAUTH_URL)

class CredentialsSigninError extends CredentialsSignin {}
const credentialsSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
})

export const VERIFICATION_TOKEN_TTL = 2 * 60 * 60 // 2 hours

const authOptions: NextAuthConfig = {
  debug: IS_DEV,

  // logger:

  theme: {
    colorScheme: "auto",
    // logo: "/images/logo.svg",
    // brandColor: "#000",
    // brandText: "#000",
  },

  // TODO: maybe in prod?
  useSecureCookies: false,

  // cookies: {
  //   sessionToken: CookieOption,
  //   callbackUrl: CookieOption,
  //   csrfToken: CookieOption,
  //   pkceCodeVerifier: CookieOption,
  //   state: CookieOption,
  //   nonce: CookieOption,
  // },

  adapter: codeshareAdapter,

  providers: [
    // GoogleProvider({
    //   clientId: GOOGLE_ID,
    //   clientSecret: GOOGLE_SECRET,
    //   // authorization: {
    //   //   params: {
    //   //     prompt: "consent",
    //   //     access_type: "offline",
    //   //     response_type: "code"
    //   //   }
    //   // }
    // }),
    // Passwordless / email sign in
    // EmailProvider({
    //   server: process.env.MAIL_SERVER,
    //   from: 'NextAuth.js <no-reply@example.com>'
    // }),
    Credentials<{
      email: { label: string; type: string }
      password: { label: string; type: string }
    }>({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(c) {
        // validate credentials via zod
        let email: string, password: string

        try {
          const validated = credentialsSchema.parse(c)
          email = validated.email
          password = validated.password
        } catch (error: unknown) {
          throw new CredentialsSigninError(
            "Invalid credentials: " + (error as Error).message,
          )
        }

        // TODO: obfuscate error for security?
        const user = await usersModel.getOneByCredentials({ email, password })

        return user
      },
    }),
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: "Codeshare <noreply@codeshare.io>",
      maxAge: VERIFICATION_TOKEN_TTL, // 24 hours,
    }),
    // (() => {
    //   const credentials = Credentials<{
    //     email: { label: string; type: string }
    //     password: { label: string; type: string }
    //   }>({
    //     credentials: {
    //       email: { label: "Email", type: "email" },
    //       password: { label: "Password", type: "password" },
    //     },
    //     async authorize(c) {
    //       // validate credentials via zod
    //       let email: string, password: string

    //       try {
    //         const validated = credentialsSchema.parse(c)
    //         email = validated.email
    //         password = validated.password
    //       } catch (error: unknown) {
    //         throw new CredentialsSigninError(
    //           "Invalid credentials: " + (error as Error).message,
    //         )
    //       }

    //       // TODO: obfuscate error for security?
    //       const user = await usersModel.getOneByCredentials({ email, password })

    //       return user
    //     },
    //   })
    //   // HACK: override credentials type to custom.. so that db sessions can be used w/ it
    //   // https://github.com/nextauthjs/next-auth/blob/1bd4dd8316e33d14636e5345fc24e4ef380f4789/packages/core/src/lib/utils/assert.ts#L194
    //   // @ts-expect-error - hack to override type
    //   credentials.type = "codeshare_credentials"
    //   // @ts-expect-error - hack to override type
    //   credentials.updateUser = () => {}

    //   return credentials
    // })(),
  ],

  secret: NEXTAUTH_SECRET,

  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
    // generateSessionToken: async () => {
    //   // uuid
    // },
  },

  // jwt: {...},

  // pages: {
  //   signIn: "/auth/signin",
  //   signOut: "/auth/signout",
  //   error: "/auth/error",
  //   verifyRequest: "/auth/verify-request",
  //   newUser: "/auth/new-user",
  // },

  callbacks: {
    // session({user, session}) {
    //   if (session.user) {
    //     session.user.id = user.id;
    //   }

    //   return session;
    // },
    // jwt: async ({ token, user, account, profile, isNewUser, session }) => {
    //   //
    // },
    redirect({ url, baseUrl }) {
      console.log("REDIRECT: check", url, baseUrl)
      const newUrl = url.startsWith(baseUrl) ? url : baseUrl

      if (IS_DEV) {
        return newUrl.replace(/^https/, "http")
      }

      console.log("REDIRECT: new url", url, baseUrl, newUrl)
      return newUrl
    },
  },
}

export default authOptions
