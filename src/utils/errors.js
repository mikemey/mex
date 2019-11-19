class ClientError extends Error {
  constructor (message, fatal = true) {
    super(message)
    this.name = this.constructor.name
    this.clientMessage = message
    this.fatal = fatal
  }
}

module.exports = { ClientError }
