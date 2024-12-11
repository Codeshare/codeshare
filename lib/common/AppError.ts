import BaseError from 'baseerr'

export default class AppError<Data = {}> extends BaseError<
  Data & { status: number }
> {
  status!: number
}

export class AppErrorNullableStatus<Data> extends BaseError<
  Data & { status?: number }
> {
  status!: number
}
