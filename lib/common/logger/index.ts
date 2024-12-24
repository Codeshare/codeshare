import { IS_BROWSER } from "@/lib/const/const"

import { LoggerType as BrowserLoggerType } from "./logger.browser"

export type LoggerType = BrowserLoggerType

export default IS_BROWSER
  ? await import("./logger.browser").then((m) => m.default)
  : // HACK: fix me later (to server)
    await import("./logger.browser").then((m) => m.default)
