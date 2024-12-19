export async function isomorphicImport<T>(path: string): Promise<T> {
  if (typeof window === "undefined") {
    return import(`${path}.server`)
  } else {
    return import(`${path}.browser`)
  }
}
