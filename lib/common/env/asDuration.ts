/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { accessors } from "env-var"
import parseDuration from "parse-duration"

import AppError, { AppErrorProps } from "../AppError"

type ArrayUnitsType = Array<parseDuration.Units>

const defaultUnits: ArrayUnitsType = [
  "nanosecond",
  "ns",
  "µs",
  "μs",
  "us",
  "microsecond",
  "millisecond",
  "ms",
  "second",
  "sec",
  "s",
  "minute",
  "min",
  "m",
  "hour",
  "hr",
  "h",
  "day",
  "d",
  "week",
  "wk",
  "w",
  "month",
  "b",
  "year",
  "yr",
  "y",
]

interface AsDurationErrorProps extends AppErrorProps {
  value: string
  units: ArrayUnitsType
}
class AsDurationError extends AppError<AsDurationErrorProps> {}

function asDuration(value: string, units: ArrayUnitsType = defaultUnits) {
  let ret

  const msDuration: number | null = parseDuration(value)

  AsDurationError.assert<AsDurationErrorProps>(
    msDuration !== null,
    "should be a valid duration string",
    { value, units },
  )

  try {
    ret = accessors.asInt(msDuration.toString())
  } catch (err) {
    // should never happen
    throw AsDurationError.wrap<AsDurationErrorProps>(
      err,
      `${value} must be a number`,
      { value, units },
    )
  }

  return ret
}

export default asDuration
