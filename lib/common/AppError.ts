import BaseError from "baseerr"

export type RequiredAppErrorProps = { code: string; status: number }
export type OmittedAppErrorProps = Omit<
  RequiredAppErrorProps,
  "code" | "status"
>
export type AppErrorProps = Partial<RequiredAppErrorProps>

export interface ErrorShape {
  message: string
  stack?: string
}

function toErrorShape(err: unknown): ErrorShape {
  if (
    typeof err === "string" ||
    typeof err === "number" ||
    typeof err === "boolean" ||
    err === undefined ||
    err === null
  ) {
    return {
      message: "" + err,
      stack: typeof err,
    }
  }

  if (typeof err === "object" && "message" in err) {
    return err as ErrorShape
  }

  return {
    message: JSON.stringify(err),
    stack: typeof err,
  }
}

export default class AppError<
  Props extends AppErrorProps = AppErrorProps,
> extends BaseError<RequiredAppErrorProps> {
  constructor(message: string, props?: Props) {
    const status = props?.status ?? 500
    super(message, {
      status,
      code: AppError.codeFromStatus(status),
      ...props,
    })
  }

  static createFromStatus<
    StaticMethodProps extends OmittedAppErrorProps = OmittedAppErrorProps,
  >(
    status: number,
    message: string = this.messageFromStatus(status),
    data?: StaticMethodProps | undefined | null,
  ): AppError {
    return new this(message, {
      status,
      code: this.codeFromStatus(status),
      ...data,
    })
  }

  static wrapWithStatus<
    StaticMethodProps extends OmittedAppErrorProps = OmittedAppErrorProps,
  >(
    source: unknown,
    status: number,
    message: string = this.messageFromStatus(status),
    data?: StaticMethodProps | undefined | null,
  ): AppError {
    return super.wrap<RequiredAppErrorProps>(toErrorShape(source), message, {
      status,
      code: this.codeFromStatus(status),
      ...data,
    })
  }

  static assertWithStatus<
    StaticMethodProps extends OmittedAppErrorProps = OmittedAppErrorProps,
  >(
    condition: unknown,
    status: number,
    message: string = this.messageFromStatus(status),
    data?: StaticMethodProps | undefined | null,
  ): asserts condition {
    return super.assert<RequiredAppErrorProps>(condition, message, {
      status,
      code: this.codeFromStatus(status),
      ...data,
    })
  }

  static assert<StaticMethodProps extends AppErrorProps = AppErrorProps>(
    condition: unknown,
    message: string,
    data?: StaticMethodProps | undefined | null,
  ): asserts condition {
    const status = data?.status ?? 500

    super.assert<RequiredAppErrorProps>(condition, message, {
      status,
      code: this.codeFromStatus(status),
      ...data,
    } as RequiredAppErrorProps)
  }

  static wrap<StaticMethodProps extends AppErrorProps = AppErrorProps>(
    source: unknown,
    message: string,
    data?: StaticMethodProps | undefined | null,
  ): AppError {
    const status = data?.status ?? 500

    return super.wrap<RequiredAppErrorProps>(toErrorShape(source), message, {
      status: status,
      code: this.codeFromStatus(status),
      ...data,
    })
  }

  /* static helper methods */

  static codeFromStatus(status: number): string {
    const message = this.messageFromStatus(status)

    return message.toUpperCase().replace(/ /g, "_")
  }

  static messageFromStatus(status: number): string {
    switch (status) {
      case 400:
        return "Bad Request"
      case 401:
        return "Unauthorized"
      case 403:
        return "Forbidden"
      case 404:
        return "Not Found"
      case 409:
        return "Conflict"
      case 500:
        return "Internal Server Error"
      case 501:
        return "Not Implemented"
      case 502:
        return "Bad Gateway"
      case 503:
        return "Service Unavailable"
      default:
        return "Unexpected Error"
    }
  }
}
