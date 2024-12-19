import { IS_DEV } from "@/lib/const/const"

type LogMethodType = (message?: unknown, ...optionalParams: unknown[]) => void

interface LoggerInterface {
  fatal: LogMethodType
  error: LogMethodType
  warn: LogMethodType
  info: LogMethodType
  debug: LogMethodType
  trace: LogMethodType
}

export type LoggerType = LoggerInterface

const browserLogger: LoggerInterface = {
  fatal: (...args) => {
    if (console.error) {
      console.error("FATAL!", ...args)
    } else {
      console.log("FATAL:", ...args)
    }
  },
  error: (...args) => {
    if (!IS_DEV) return
    if (console.error) {
      console.error(...args)
    } else {
      console.log("ERROR:", ...args)
    }
  },
  warn: (...args) => {
    if (console.warn) {
      console.warn(...args)
    } else {
      console.log("WARN:", ...args)
    }
  },
  info: (...args) => {
    if (console.info) {
      console.info(...args)
    } else {
      console.log("INFO:", ...args)
    }
  },
  debug: (...args) => {
    if (!IS_DEV) return
    if (console.debug) {
      console.debug(...args)
    } else {
      console.log("DEBUG:", ...args)
    }
  },
  trace: (...args) => {
    if (!IS_DEV) return
    if (console.trace) {
      console.trace(...args)
    } else {
      console.log("TRACE:", ...args)
    }
  },
}

export default browserLogger
