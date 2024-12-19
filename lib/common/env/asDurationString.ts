/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { accessors } from "env-var"

import AppError, { AppErrorProps } from "../AppError"

export type Unit = "ms" | "s" | "m" | "h" | "d"
export type Duration = `${number} ${Unit}` | `${number}${Unit}`

interface AsDurationStringErrorProps extends AppErrorProps {
  value: string
  units: Array<Unit>
}
class AsDurationStringError extends AppError<AsDurationStringErrorProps> {}

function asDurationString(
  value: string,
  units: Array<Unit> = ["ms", "s", "m", "h", "d"],
): Duration {
  let ret

  try {
    ret = accessors.asString(value)
  } catch (err) {
    throw AsDurationStringError.wrap(err, `${value} must be a string`, {
      value,
      units,
    })
  }

  const re = new RegExp(`^\\d+\\s*${units.join("|")}$`)
  AsDurationStringError.assert<AsDurationStringErrorProps>(
    re.test(ret),
    "should be a valid duration string",
    { value, units },
  )

  return ret as Duration
}

export default asDurationString
