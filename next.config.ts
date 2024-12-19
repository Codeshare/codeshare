/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())
import { get, publicEnv } from "./lib/common/env/env"

// import { EnvironmentPlugin } from "webpack"

const SOURCE_MAPS = get("SOURCE_MAPS").default("false").asBool()

// Load environment variables from .env file


console.log("publicEnv!", publicEnv)

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ...publicEnv,
    VERCEL_URL: 'http://localhost:3000',
    NEXTAUTH_URL: 'VERCEL_URL/-/api/auth',
    NEXTAUTH_URL_INTERNAL: 'NEXTAUTH_URL'
  },
  productionBrowserSourceMaps: SOURCE_MAPS,
  // webpack: (config, { isServer, webpack }) => {
  //   // if (isServer) {
  //   //   // SERVER Environment Variables
  //   //   return config
  //   // } else {
  //   //   // BROWSER Environment Variables
  //   //   const requiredEnvKeys = Object.keys(process.env).filter((key) =>
  //   //     key.startsWith("NEXT_PUBLIC_"),
  //   //   )
  //   //   const optionalEnvKey = []
  //   //   let browserEnv = {}

  //   //   requiredEnvKeys.forEach((key) => {
  //   //     browserEnv[key] = get(key).required().asString()
  //   //   })
  //   //   optionalEnvKey.forEach((key) => {
  //   //     if (process.env[key] != null) {
  //   //       browserEnv[key] = process.env[key]
  //   //     }
  //   //   })

  //   //   console.log("BROWSER ENV", browserEnv)
  //   //   config.plugins.push(new webpack.EnvironmentPlugin(browserEnv))
  //   // }

  //   return config
  // },
}

export default nextConfig
