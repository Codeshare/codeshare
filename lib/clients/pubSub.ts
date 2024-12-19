class PubSub {
  async publish<T>(topic: string, data: T) {
    console.log(`PubSub: publishing ${topic}`, data)
  }
  subscribe<T>(topic: string, cb: (data: T) => void) {
    console.log(`PubSub: subscribing to ${topic}`)
    cb({} as T)
  }
}

const pubSub = new PubSub()

export default pubSub
