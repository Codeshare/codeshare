type ExactOmit<T, K extends keyof T = keyof T> = Omit<T, K> & {
  [P in K]?: never
}

export default ExactOmit
