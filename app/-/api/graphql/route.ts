import { ApolloServer } from "@apollo/server"
import { startServerAndCreateNextHandler } from "@as-integrations/next"
import { buildSchema, Query, Resolver } from "type-graphql"

import getContext from "./resolvers/getContext"

// import { UserRow } from "@/lib/models/usersModel"

@Resolver()
class HelloResolver {
  @Query(() => String)
  hello() {
    return "world"
  }
}

const schema = await buildSchema({
  resolvers: [HelloResolver],
})

type Context = {
  // xForwardedFor: string
  clientIP: string
  // me: UserRow | null
}

const server = new ApolloServer<Context>({
  schema,
})

const handler = startServerAndCreateNextHandler(server, {
  context: async (req, _res) => getContext({ req }),
})

export async function GET(request: Request) {
  return handler(request, undefined)
}

export async function POST(request: Request) {
  return handler(request, undefined)
}
