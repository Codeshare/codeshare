import { IS_BROWSER } from "@/lib/const/const"

import { LoggerType as BrowserLoggerType } from "./logger.browser"

export type LoggerType = BrowserLoggerType

export default IS_BROWSER
  ? import("./logger.browser").then((m) => m.default)
  : import("./logger.server").then((m) => m.default)
