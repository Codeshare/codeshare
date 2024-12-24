/* eslint no-relative-import-paths/no-relative-import-paths: "off" */
// CAUTION: this file is used by the build process can cannot use alias imports
import { accessors } from "env-var"

import AppError, { AppErrorProps } from "../AppError"

interface AsTemplateStringErrorProps extends AppErrorProps {
  template: string
  envVarName?: string
}

class AsTemplateStringError extends AppError<AsTemplateStringErrorProps> {}

function asTemplateString(template: string) {
  const interpolated = template.replace(
    /\${([^}]+)}/g,
    (_match, envVarName: string) => {
      const trimmedEnvVarName = envVarName.trim()

      AsTemplateStringError.assert<AsTemplateStringErrorProps>(
        trimmedEnvVarName != "",
        "Environment variable name cannot be empty",
        { template },
      )
      try {
        return accessors.asString(trimmedEnvVarName)
      } catch (err) {
        throw AsTemplateStringError.wrap<AsTemplateStringErrorProps>(
          err,
          "Failed to interpolate environment variable",
          {
            template,
            envVarName,
          },
        )
      }
    },
  )

  return interpolated
}

export default asTemplateString
