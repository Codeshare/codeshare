/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { accessors } from "env-var"

import AppError, { AppErrorProps } from "../AppError"

interface AsTemplateStringErrorProps extends AppErrorProps {
  template: string
}

class AsTemplateStringError extends AppError<AsTemplateStringErrorProps> {}

function asTemplateString(template: string) {
  const interpolated = template.replace(
    /\${([^}]+)}/g,
    (match, envVarName: string) => {
      const trimmedEnvVarName = envVarName.trim()

      try {
        AsTemplateStringError.assert<AsTemplateStringErrorProps>(
          trimmedEnvVarName != "",
          "Environment variable name cannot be empty",
          { template },
        )
        return accessors.asString(trimmedEnvVarName)
      } catch (err) {
        throw AppError.wrap(err, "Failed to interpolate environment variable", {
          envVarName,
        })
      }
    },
  )

  return interpolated
}

export default asTemplateString
