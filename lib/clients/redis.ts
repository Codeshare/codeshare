import { VercelKV as Redis } from "@vercel/kv"
import { get } from "env-var"

const KV_REST_API_URL = get("KV_REST_API_URL").required().asString()
const KV_REST_API_TOKEN = get("KV_REST_API_TOKEN").required().asString()

const redis = new Redis({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
})

export default redis
