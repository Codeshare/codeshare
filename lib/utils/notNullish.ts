import AppError from "@/lib/common/AppError"

// define a ts helper method that asserts a value is not nullish and returns it
export function notNullish<T>(value: T, message: string): T {
  AppError.assert(value != null, message)
  return value
}
