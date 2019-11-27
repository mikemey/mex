class ClientError extends Error {
  constructor (message, response, keepConnection = true) {
    super(message)
    this.name = this.constructor.name
    this.clientResponse = response
    this.keepConnection = keepConnection
  }
}

module.exports = { ClientError }
