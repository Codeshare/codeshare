import { startServerAndCreateNextHandler } from "@as-integrations/next"
import { ApolloServer } from "@apollo/server"
import { gql } from "graphql-tag"
import { NextApiRequest } from "next"
import getClientIp from "@/lib/getClientIP"
import getContext from "./resolvers/getContext"
// import { UserRow } from "@/lib/models/usersModel"

const resolvers = {
  Query: {
    hello: () => "world",
  },
}

type Context = {
  // xForwardedFor: string
  clientIP: string
  // me: UserRow | null
}

const server = new ApolloServer<Context>({
  resolvers,
})

const handler = startServerAndCreateNextHandler<NextApiRequest, Context>(
  server,
  {
    context: async (req: NextApiRequest) => {
      return getContext({ req })
    },
  },
)

export { handler as GET, handler as POST }
