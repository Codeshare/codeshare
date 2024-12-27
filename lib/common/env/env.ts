/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { from } from "env-var"
import wrapper from "ts-wrappers"

import { IS_BROWSER } from "../../const/const"
import AppError, { AppErrorProps } from "../AppError"
// import logger from "../logger"
import asDuration from "./asDuration"
import asDurationString from "./asDurationString"
import asTemplateString from "./asTemplateString"

const envExtensions = {
  asDuration,
  asDurationString,
  asTemplateString,
}
const nextPublicEnv: { [key: string]: string | undefined } = {
  // HACK: NEXT_PUBLIC_ environment variable are replaced inline by the build process
  // so we need to use the process.env.NEXT_PUBLIC_... verbatim
  // eg, "NEXT_PUBLIC_NODE_ENV": process.env.NEXT_PUBLIC_NODE_ENV,
  NEXT_PUBLIC_TJ: "TJ WUZ HERE",
}
const envInstance = from(
  {
    ...process.env,
    ...nextPublicEnv,
  },
  envExtensions,
)

type GetEnv = typeof envInstance.get

interface EnvErrorProps extends AppErrorProps {
  key: string
}
class EnvError extends AppError<EnvErrorProps> {}

// wrap 'get' to wrap 'required'
export const get = wrapper((getEnv: GetEnv, ...args: Parameters<GetEnv>) => {
  const [key] = args
  const keyStr = key.toString()
  let ret = getEnv(key)

  // HACK: NEXT_PUBLIC_ environment variables are required by default for the build process
  if (keyStr.startsWith("NEXT_PUBLIC_")) {
    // NOTE: NEXT_PUBLIC_ environment variable are replaced inline by the build process
    // so we need to use the process.env.NEXT_PUBLIC_... verbatim
    EnvError.assert<EnvErrorProps>(
      key in nextPublicEnv,
      "All public environment variables are required",
      { key: keyStr },
    )
    ret = ret.required() as ReturnType<GetEnv>
  }

  return ret
})(envInstance.get as GetEnv)

console.log("ENV:")
if (IS_BROWSER) {
  console.log(window?.process?.env)
} else {
  console.log(process?.env)
}

export const publicEnv = {
  ...nextPublicEnv,
  VERCEL_URL: get("VERCEL_URL")
    .default("http://localhost:3000")
    .required()
    .asString(),
  NEXTAUTH_URL: get("NEXTAUTH_URL")
    .default("${VERCEL_URL}/-/api/auth")
    .required()
    .asTemplateString(),
  NEXTAUTH_URL_INTERNAL: get("NEXTAUTH_URL")
    .default("${NEXTAUTH_URL}")
    .asTemplateString(),
}
