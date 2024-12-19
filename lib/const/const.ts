// start-enforce-alphabetization
// get("NEXT_PUBLIC_NODE_ENV").required().asString() === "development"
export const IS_BROWSER = typeof window !== "undefined"
export const IS_DEV = process.env.NEXT_PUBLIC_NODE_ENV === "development"
export const IS_SERVER = typeof window === "undefined"
// end-enforce-alphabetization
