import { ApolloServer } from "@apollo/server"
import { startServerAndCreateNextHandler } from "@as-integrations/next"
import { NextApiRequest, NextApiResponse } from "next"
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

const handler = startServerAndCreateNextHandler<NextApiRequest, Context>(
  server,
  {
    context: async (req: NextApiRequest, _res: NextApiResponse) => {
      return getContext({ req })
    },
  },
)

export { handler as GET, handler as POST }
